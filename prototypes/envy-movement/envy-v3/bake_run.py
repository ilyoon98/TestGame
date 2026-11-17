"""Bake Envy's right-facing run with the approved walk's art and body rig."""

import math

import numpy as np
from PIL import Image

from bake_idle import ramp
from bake_walk import (
    COUNT, GROUND, ROOT, SIZE, export_locomotion, knee_at, pant_leg,
    premultiply, sample_texture, shoe_at,
)
from bake_walk_v2 import LEGS, animate_upper, load_lower_body, offset_from_pivot, shoe_for_pose


PERIOD_MS = 704
STRIDE = 256
STANCE = 0.36
LAND_PITCH = 11
PUSH_PITCH = -36
OUTPUT = ROOT / "run-v2"


def cutout(sheet, bounds):
    part = sheet.crop(bounds)
    alpha = part.getchannel("A").point(lambda value: value if value >= 8 else 0)
    part.putalpha(alpha)
    return part.crop(alpha.getbbox())


def load_upper_parts():
    sheet = Image.open(ROOT / "run" / "upper-parts-hood-fit.png").convert("RGBA")
    w, h = sheet.size
    torso = sheet.crop((0, 0, w // 2, h))
    alpha = torso.getchannel("A").point(lambda value: value if value >= 8 else 0)
    torso.putalpha(alpha)
    with Image.open(ROOT / "run" / "upper-parts-round-face.png") as original:
        original_alpha = original.getchannel("A").crop((0, 0, w // 2, h))
        source_left, source_top, source_right, source_bottom = original_alpha.point(
            lambda value: value if value >= 8 else 0,
        ).getbbox()
    edited_left, _, edited_right, _ = alpha.getbbox()
    scale = 133 / (source_right - source_left)
    # Expand horizontally for the open hood while keeping the torso registered.
    left_edge = math.floor((edited_left - source_left) * scale)
    right_edge = math.ceil((edited_right - source_left) * scale)
    right = cutout(sheet, (w // 2, 0, w, h // 2))
    left = cutout(sheet, (w // 2, h // 2, w, h))
    resample = Image.Resampling.LANCZOS
    upper = Image.new("RGBA", (SIZE, SIZE))
    bounds = (source_left + left_edge / scale, source_top, source_left + right_edge / scale, source_bottom)
    upper.paste(torso.resize((right_edge - left_edge, 262), resample, box=bounds), (180 + left_edge, 69))
    return upper, right.resize((84, 75), resample), left.resize((74, 61), resample)


def arm_layer(arm, shoulder, degrees, *, elbow=None, flex=0, clearance=0):
    layer = Image.new("RGBA", (SIZE, SIZE))
    x, y = shoulder
    if flex or clearance:
        # Keep the shoulder and upper sleeve anchored while the cuff and fist
        # rotate with the forearm. The bend fades across the elbow fabric.
        margin = 24
        padded = Image.new("RGBA", (arm.width + 2 * margin, arm.height + 2 * margin))
        padded.paste(arm, (margin, margin))
        rows, columns = np.indices((padded.height, padded.width), dtype=np.float32)
        joint_x, joint_y = (coordinate + margin for coordinate in elbow)
        weight = ramp(columns, joint_x - 7, joint_x + 22)
        dx, dy = offset_from_pivot(columns, rows, (joint_x, joint_y), math.radians(flex) * weight)
        sleeve = ramp(rows, margin + 18, joint_y)
        pixels = sample_texture(
            premultiply(padded),
            (columns + dx - clearance * sleeve).ravel(),
            (rows + dy - abs(clearance) * 0.8 * sleeve).ravel(),
        ).reshape((padded.height, padded.width, 4))
        posed_arm = Image.fromarray(pixels)
    else:
        margin = 0
        posed_arm = arm
    layer.paste(posed_arm, (
        x - round(arm.width * 0.24) - margin, y - round(arm.height * 0.22) - margin,
    ))
    return layer.rotate(degrees, resample=Image.Resampling.BICUBIC, center=shoulder)


def stabilize_head(upper, bob, counter_tilt):
    # Keep the head aimed forward as the jacket and shoulders lean.
    y, x = np.mgrid[42:218, 148:347].astype(np.float32)
    head = 1.0 - ramp(y, 176 + bob, 211 + bob)
    dx, dy = offset_from_pivot(x, y, (261, 193 + bob), -math.radians(counter_tilt) * head)
    rgba = np.array(upper)
    rgba[42:218, 148:347] = sample_texture(
        premultiply(rgba), (x + dx).ravel(), (y + dy).ravel(),
    ).reshape((*x.shape, 4))
    return Image.fromarray(rgba)


def sprint_arm_angles(phase):
    swing = math.cos(math.tau * (phase - 0.045))
    return -35 - 39 * swing, -31 + 36 * swing


def sprint_elbow_flex(phase):
    swing = math.cos(math.tau * (phase - 0.065))
    return 3 - 15 * swing, 2 + 13 * swing


def pose_upper(upper, texture, right_arm, left_arm, phase, bob, lean, drive, *,
               arm_angles=None, shoulder_roll=0, elbow_flex=(0, 0), elbow_clearance=(0, 0)):
    pump = math.cos(math.tau * phase)
    right_angle, left_angle = arm_angles if arm_angles is not None else (-30 - 47 * pump, -30 + 43 * pump)
    right_flex, left_flex = elbow_flex
    right_clearance, left_clearance = elbow_clearance
    posed = arm_layer(
        left_arm, (273, 212 + bob + shoulder_roll), left_angle,
        elbow=(21, 47), flex=left_flex, clearance=left_clearance,
    )
    posed.alpha_composite(animate_upper(
        upper, texture, phase, bob, arm_swing=0,
        hood_sway=3.5, keyring_swing=12.0, keyring_bias=10.0,
    ))
    posed.alpha_composite(arm_layer(
        right_arm, (237, 218 + bob - shoulder_roll), right_angle,
        elbow=(23, 52), flex=right_flex, clearance=right_clearance,
    ))
    posed = stabilize_head(posed, bob, 0.58 * lean)
    leaned = posed.rotate(-lean, resample=Image.Resampling.BICUBIC, center=(248, 301 + bob))
    translated = Image.new("RGBA", (SIZE, SIZE))
    translated.alpha_composite(leaned, (drive, 0))
    return translated


def run_foot(phase, center, stride=STRIDE):
    half_step = stride * STANCE / 2
    if phase < STANCE:
        heel = max(0.0, 1.0 - phase / 0.095)
        toe = max(0.0, (phase - 0.20) / (STANCE - 0.20))
        return center + half_step - stride * phase, 0.0, LAND_PITCH * heel + PUSH_PITCH * toe, True

    swing = (phase - STANCE) / (1.0 - STANCE)
    ease = swing * swing * (3.0 - 2.0 * swing)
    # Match the stance velocity at toe-off and just before landing. The foot
    # initially travels back while the heel lifts, then reaches forward.
    carry = stride * (1.0 - STANCE) * swing * (1.0 - swing) * (1.0 - 2.0 * swing)
    reach = 22.0 * float(ramp(swing, 0.52, 0.78)) * (1.0 - float(ramp(swing, 0.81, 1.0)))
    travel = -half_step + 2.0 * half_step * ease - carry + reach
    rise = math.sin(math.pi * swing)
    lift = 54.0 * rise**0.82 * (1.45 - 0.85 * swing)
    pitch = PUSH_PITCH * (1.0 - ease) + LAND_PITCH * ease - 17.0 * rise * (1.0 - swing)
    return center + travel, lift, pitch, False


def render_cycle(*, stride=STRIDE, extra_lean=0, count=COUNT, sprint_arms=False):
    trousers, shoes = load_lower_body()
    upper, right_arm, left_arm = load_upper_parts()
    upper_texture = premultiply(upper)
    frames, contacts, joints, flights, leans = [], [], [], [], []
    for index in range(count):
        phase = index / count
        step = 2.0 * math.tau * phase
        bob = round(8.0 * math.sin(step + 0.12))
        lean = 18.0 + extra_lean + 3.0 * math.cos(step - 3.7)
        drive = round(3.5 + 3.5 * math.cos(step - 3.5))
        frame = Image.new("RGBA", (SIZE, SIZE))
        frame_contacts, frame_joints = [], {}
        for leg_index, (name, hip_x, center, ground, offset, width) in enumerate(LEGS):
            leg_phase = (phase + offset) % 1.0
            foot_x, lift, pitch, planted = run_foot(leg_phase, center - 8, stride)
            texture = shoe_for_pose(shoes[leg_index], leg_index, planted, pitch)
            shoe, position, ankle = shoe_at(texture, foot_x, ground, lift, pitch)
            hip = np.array([hip_x + drive, 301 + bob], dtype=float)
            knee = knee_at(hip, ankle, thigh=68, shin=67)
            if planted:
                extension = float(ramp(leg_phase, 0.23, STANCE)) * 0.74
                knee = knee * (1.0 - extension) + (hip + ankle) * 0.5 * extension
            frame.alpha_composite(shoe, position)
            frame.alpha_composite(pant_leg(trousers[leg_index], width, hip, knee, ankle))
            sole = position[1] + shoe.height
            if planted:
                if sole != ground:
                    raise ValueError(f"The {name} foot missed its contact line in frame {index}.")
                frame_contacts.append([name, round(foot_x, 3), ground])
            frame_joints[name] = {
                "hip": hip.round(2).tolist(),
                "knee": knee.round(2).tolist(),
                "ankle": ankle.round(2).tolist(),
                "shoePitchDeg": round(pitch, 2),
                "soleY": sole,
            }
        arm_angles = sprint_arm_angles(phase) if sprint_arms else None
        shoulder_roll = round(1.5 * math.sin(math.tau * phase)) if sprint_arms else 0
        elbow_flex = sprint_elbow_flex(phase) if sprint_arms else (0, 0)
        backswing = math.cos(math.tau * (phase - 0.045))
        elbow_clearance = (-12 - 4 * backswing, 6) if sprint_arms else (0, 0)
        frame.alpha_composite(pose_upper(
            upper, upper_texture, right_arm, left_arm, phase, bob, lean, drive,
            arm_angles=arm_angles, shoulder_roll=shoulder_roll, elbow_flex=elbow_flex,
            elbow_clearance=elbow_clearance,
        ))
        if not frame_contacts:
            if any(frame_joints[name]["soleY"] >= ground - 2 for name, _, _, ground, _, _ in LEGS):
                raise ValueError(f"A foot is too close to the ground in flight frame {index}.")
            flights.append(index)
        frames.append(frame)
        contacts.append(frame_contacts)
        joints.append(frame_joints)
        leans.append(round(lean, 2))

    for index, side in ((0, "right"), (count // 2, "left")):
        opposite = "left" if side == "right" else "right"
        if [contact[0] for contact in contacts[index]] != [side]:
            raise ValueError(f"Wrong landing leg in frame {index}.")
        if joints[index][side]["ankle"][0] <= joints[index][opposite]["ankle"][0]:
            raise ValueError(f"The {side} landing foot is behind the swing foot.")
    if not any(index < count // 2 for index in flights) or not any(index >= count // 2 for index in flights):
        raise ValueError("Each running step needs a flight phase.")

    return frames, contacts, joints, flights, leans


def bake():
    frames, contacts, joints, flights, leans = render_cycle()
    export_locomotion(
        OUTPUT, frames, contacts, action="run", period_ms=PERIOD_MS, stride=STRIDE,
        art_source="Walk leg textures and ImageGen upper-body parts, posed with the locomotion rig",
        rig={
            "orientationReference": "../references/envy-turnaround-hood-fit.png",
            "orientationView": "RIGHT 3/4",
            "poseReference": "../references/envy-run-key-poses.png",
            "cameraNearLeg": "right",
            "cameraFarLeg": "left",
            "leadContacts": [{"frame": 0, "leg": "right"}, {"frame": COUNT // 2, "leg": "left"}],
            "flightFrames": flights,
            "torsoLeanDegreesByFrame": leans,
            "jointCoordinatesByFrame": joints,
        },
    )


if __name__ == "__main__":
    bake()
