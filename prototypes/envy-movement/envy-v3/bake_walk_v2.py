"""Bake the walk at the turnaround's right-facing 3/4 angle."""

import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageChops, ImageDraw

from bake_idle import ramp
from bake_walk import (
    COUNT, GROUND, ROOT, SIZE, export_walk, foot_pose, knee_at, pant_leg,
    premultiply, read_parts, sample_texture, shoe_at,
)


OUTPUT = ROOT / "walk-v2"
STRIDE = 104

# Each hip is placed for the same camera as RIGHT 3/4 in the turnaround.
# Draw the far anatomical left leg first, even when its foot leads.
LEGS = (
    ("left", 258, 254, GROUND - 2, 0.5, 52),
    ("right", 241, 253, GROUND, 0.0, 61),
)


def load_upper_body():
    image = Image.open(OUTPUT / "right-3q-hood-fit.png").convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: value if value >= 5 else 0)
    with Image.open(OUTPUT / "right-3q-open-hood.png") as reference:
        left, top, right, bottom = reference.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
    if image.size != (1024, 1536):
        raise ValueError("The upper-body cutout uses the original side reference coordinates.")

    # Keep the full glove and console while freeing the pelvis and both legs.
    body_mask = Image.new("L", image.size)
    ImageDraw.Draw(body_mask).polygon([
        (230, 74), (820, 74), (820, 960), (738, 1031), (639, 1027),
        (633, 943), (619, 934), (607, 946), (525, 940), (518, 983),
        (508, 1006), (488, 1028), (451, 1027), (430, 1013), (425, 979),
        (425, 946), (402, 946), (363, 936), (343, 911), (230, 895),
    ], fill=255)
    image.putalpha(ImageChops.multiply(alpha, body_mask))
    height = 394
    width = round((right - left) * height / (bottom - top))
    scaled = image.crop((left, top, right, bottom)).resize((width, height), Image.Resampling.LANCZOS)
    upper = Image.new("RGBA", (SIZE, SIZE))
    upper.paste(scaled, ((SIZE - width) // 2, GROUND - height))
    return upper


def offset_from_pivot(x, y, pivot, angle):
    dx, dy = x - pivot[0], y - pivot[1]
    sine, cosine = np.sin(angle), np.cos(angle) - 1
    return cosine * dx + sine * dy, -sine * dx + cosine * dy


def animate_upper(upper, texture, phase, bob, *, arm_swing=5.5,
                  hood_sway=1.8, keyring_swing=6.0, keyring_bias=0):
    y, x = np.mgrid[54:353, 168:339].astype(np.float32)
    cycle = math.tau * phase
    step = math.cos(cycle)
    hood = (1 - ramp(y, 115, 168)) * math.sin(2 * cycle - 0.60)
    sleeve = (1 - ramp(x, 238, 263)) * ramp(y, 217, 299)
    arm_x, arm_y = offset_from_pivot(x, y, (230, 217), math.radians(arm_swing) * step * sleeve)
    console = (
        ramp(x, 283, 296) * (1 - ramp(x, 312, 325))
        * ramp(y, 288, 304) * (1 - ramp(y, 340, 349))
    )
    key_x, key_y = offset_from_pivot(
        x, y, (296, 292),
        math.radians(keyring_bias + keyring_swing * math.sin(2 * cycle - 0.75)) * console,
    )
    sample_x = x + hood_sway * hood + arm_x + key_x
    sample_y = y + 0.7 * hood + arm_y + key_y
    rgba = np.array(upper)
    rgba[54:353, 168:339] = sample_texture(
        texture, sample_x.ravel(), sample_y.ravel(),
    ).reshape((*x.shape, 4))
    posed = Image.new("RGBA", (SIZE, SIZE))
    posed.alpha_composite(Image.fromarray(rgba), (0, bob))
    return posed


def load_lower_body():
    right_pants, left_pants, right_shoe, left_shoe = read_parts(OUTPUT / "right-3q-parts.png")
    trousers = [
        premultiply(part.resize((88, 180), Image.Resampling.LANCZOS))
        for part in (left_pants, right_pants)
    ]
    shoes = [part.resize((width, height), Image.Resampling.LANCZOS)
             for part, width, height in ((left_shoe, 62, 35), (right_shoe, 65, 38))]
    return trousers, shoes


@lru_cache(maxsize=2)
def load_flat_shoe(leg_index, size):
    left = leg_index * 65
    width, height = size
    with Image.open(OUTPUT / "flat-plant-shoes.png") as sheet:
        return sheet.crop((left, 0, left + width, height)).convert("RGBA")


def shoe_for_pose(shoe, leg_index, planted, pitch):
    if planted and pitch == 0:
        return load_flat_shoe(leg_index, shoe.size)
    return shoe


def bake():
    trousers, shoes = load_lower_body()
    upper = load_upper_body()
    upper_texture = premultiply(upper)
    frames, contacts, joints = [], [], []
    for index in range(COUNT):
        phase = index / COUNT
        bob = round(2.5 * math.sin(2 * math.tau * phase))
        frame = Image.new("RGBA", (SIZE, SIZE))
        frame_contacts, frame_joints = [], {}
        for leg_index, (name, hip_x, foot_center, ground, offset, width) in enumerate(LEGS):
            foot_x, lift, pitch, planted = foot_pose(
                (phase + offset) % 1, foot_center, stride=STRIDE,
                lift_height=14, heel_pitch=8, toe_pitch=10,
            )
            texture = shoe_for_pose(shoes[leg_index], leg_index, planted, pitch)
            shoe, position, ankle = shoe_at(texture, foot_x, ground, lift, pitch)
            hip = np.array([hip_x, 301 + bob], dtype=float)
            knee = knee_at(hip, ankle, thigh=67, shin=67)
            frame.alpha_composite(shoe, position)
            frame.alpha_composite(pant_leg(trousers[leg_index], width, hip, knee, ankle))
            if planted:
                if position[1] + shoe.getchannel("A").getbbox()[3] != ground:
                    raise ValueError(f"{name} shoe missed its ground line in frame {index}.")
                frame_contacts.append([name, round(foot_x, 3), ground])
            frame_joints[name] = {
                "hip": hip.round(2).tolist(),
                "knee": knee.round(2).tolist(),
                "ankle": ankle.round(2).tolist(),
                "shoePitchDeg": round(pitch, 2),
            }
        frame.alpha_composite(animate_upper(upper, upper_texture, phase, bob))
        frames.append(frame)
        contacts.append(frame_contacts)
        joints.append(frame_joints)

    for index, leading in ((0, "right"), (COUNT // 2, "left")):
        ankle = joints[index]
        opposite = "left" if leading == "right" else "right"
        if ankle[leading]["ankle"][0] <= ankle[opposite]["ankle"][0]:
            raise ValueError(f"Wrong leading leg at frame {index}.")
        if ankle[leading]["shoePitchDeg"] <= 0:
            raise ValueError(f"Leading shoe at frame {index} must begin heel first.")

    export_walk(OUTPUT, frames, contacts, stride=STRIDE, rig={
        "orientationReference": "../references/envy-turnaround-hood-fit.png",
        "orientationView": "RIGHT 3/4",
        "poseReference": "../references/envy-walk-key-poses.png",
        "cameraNearLeg": "right",
        "cameraFarLeg": "left",
        "leadContacts": [{"frame": 0, "leg": "right"}, {"frame": COUNT // 2, "leg": "left"}],
        "jointCoordinatesByFrame": joints,
    })


if __name__ == "__main__":
    bake()
