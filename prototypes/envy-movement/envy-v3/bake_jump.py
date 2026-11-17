"""Bake two single-play jump clips and a preview with example root motion."""

import json
import math
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from bake_run import load_upper_parts, pose_upper
from bake_walk import GROUND, ROOT, SIZE, knee_at, pant_leg, premultiply, shoe_at
from bake_walk_v2 import LEGS, load_lower_body, shoe_for_pose


FRAME_COUNT = 20
FRAME_MS = 44
COLUMNS = 5
ORIGIN = [253.25, GROUND]


@dataclass(frozen=True)
class Pose:
    frame: int
    body: tuple  # pelvis drop, forward lean, forward pelvis shift
    right: tuple  # shoe x, lift from ground, pitch
    left: tuple
    arms: tuple  # right and left shoulder angles
    root_y: int


STANDING = (
    Pose(0, (0, 4, 0), (231, 0, 0), (268, 0, 0), (-72, -74), 0),
    Pose(2, (10, 10, 3), (231, 0, 0), (268, 0, 0), (-79, -84), 0),
    Pose(3, (18, 13, 5), (231, 0, 0), (268, 0, 0), (-65, -79), 0),
    Pose(4, (16, 12, 5), (231, 0, -6), (268, 0, -3), (-42, -57), 0),
    Pose(5, (6, 8, 3), (235, 7, -18), (268, 0, -22), (-13, -27), 0),
    Pose(6, (-4, 5, 2), (239, 20, -9), (277, 6, -28), (10, 0), -14),
    Pose(7, (-5, 4, 1), (243, 36, 2), (272, 13, -22), (16, 10), -30),
    Pose(8, (-3, 4, 1), (246, 48, 10), (265, 23, -14), (20, 18), -45),
    Pose(10, (0, 4, 0), (238, 49, 4), (273, 35, -4), (17, 23), -58),
    Pose(12, (1, 6, 2), (226, 29, -10), (276, 17, 3), (-8, 6), -39),
    Pose(13, (4, 8, 3), (227, 18, -16), (272, 7, -8), (-29, -18), -18),
    Pose(14, (8, 10, 4), (233, 8, -16), (268, 0, -12), (-51, -42), 0),
    Pose(15, (22, 14, 5), (231, 0, -11), (268, 0, -2), (-67, -59), 0),
    Pose(16, (21, 13, 4), (231, 0, 0), (268, 0, 0), (-74, -72), 0),
    Pose(18, (5, 7, 1), (231, 0, 0), (268, 0, 0), (-73, -75), 0),
    Pose(19, (0, 4, 0), (231, 0, 0), (268, 0, 0), (-72, -74), 0),
)

RUNNING = (
    Pose(6, (-7, 21, 7), (201, 9, -35), (311, 37, -4), (5, -56), -16),
    Pose(7, (-7, 22, 7), (194, 24, -46), (320, 43, -13), (13, -67), -30),
    Pose(9, (-4, 21, 7), (201, 52, -49), (330, 45, -5), (23, -75), -48),
    Pose(10, (-2, 20, 6), (211, 61, -42), (334, 39, 3), (22, -75), -50),
    Pose(12, (1, 18, 3), (213, 52, -32), (318, 20, 12), (15, -71), -32),
    Pose(13, (3, 16, 2), (207, 45, -30), (304, 8, 16), (10, -69), -15),
    Pose(14, (9, 17, 3), (208, 40, -32), (292.08, 0, 15), (8, -67), 0),
    Pose(15, (21, 21, 7), (219, 42, -34), (276.08, 0, 4), (1, -65), 0),
    Pose(16, (22, 22, 8), (236, 49, -28), (260.08, 0, 0), (-12, -54), 0),
    Pose(17, (11, 20, 7), (254, 48, -19), (244.08, 0, -5), (-25, -42), 0),
)


def interpolated(keys, frame):
    indices = [key.frame for key in keys]

    def values(field):
        return tuple(np.interp(frame, indices, channel) for channel in zip(*(getattr(k, field) for k in keys)))

    return Pose(frame, values("body"), values("right"), values("left"), values("arms"),
                round(np.interp(frame, indices, [key.root_y for key in keys])))


def render_pose(pose, parts):
    trousers, shoes, upper, torso, right_arm, left_arm = parts
    bob, lean, drive = pose.body
    bob, drive = round(bob), round(drive)
    frame = Image.new("RGBA", (SIZE, SIZE))
    contacts = []
    for leg_index, (name, hip_x, _, ground, _, width) in enumerate(LEGS):
        x, lift, pitch = getattr(pose, name)
        texture = shoe_for_pose(shoes[leg_index], leg_index, lift == 0, pitch)
        shoe, placement, ankle = jump_shoe_at(texture, x, ground, lift, pitch)
        hip = np.array([hip_x + drive, 301 + bob], dtype=float)
        knee = knee_at(hip, ankle, thigh=68, shin=67)
        frame.alpha_composite(shoe, placement)
        frame.alpha_composite(pant_leg(trousers[leg_index], width, hip, knee, ankle))
        if lift == 0:
            if placement[1] + shoe.height != ground:
                raise ValueError(f"{name} missed the contact line in frame {pose.frame}")
            contacts.append([name, round(float(x), 3), ground])
    frame.alpha_composite(pose_upper(
        upper, torso, right_arm, left_arm, pose.frame / FRAME_COUNT, bob, lean, drive,
        arm_angles=pose.arms,
    ))
    return frame, contacts


def jump_shoe_at(shoe, x, ground, lift, pitch):
    if lift == 0 and pitch:
        # Counter the horizontal shift of the heel or toe as the sole rolls.
        support = 0.18 if pitch > 0 else 0.86
        support_x = round(shoe.width * support)
        alpha = shoe.getchannel("A")
        support_column = alpha.crop((support_x, 0, support_x + 1, shoe.height)).getbbox()
        support_y = support_column[3] - 1 if support_column else shoe.height - 2
        dx = support_x - 0.44 * shoe.width
        dy = support_y - 0.24 * shoe.height
        angle = math.radians(pitch)
        x += dx * (1.0 - math.cos(angle)) - dy * math.sin(angle)
    return shoe_at(shoe, x, ground, lift, pitch)


def approved_run():
    folder = ROOT / "run-v2"
    metadata = json.loads((folder / "animation.json").read_text(encoding="utf-8"))
    if metadata["originPx"] != ORIGIN or metadata["frameDurationMs"] != FRAME_MS:
        raise ValueError("The jump transition requires the registered run-v2 cadence and origin.")
    atlas = Image.open(folder / metadata["spriteSheet"]).convert("RGBA")
    frames = []
    for index in range(metadata["frameCount"]):
        row, column = divmod(index, metadata["columns"])
        frames.append(atlas.crop((column * SIZE, row * SIZE, (column + 1) * SIZE, (row + 1) * SIZE)))
    return frames, metadata


def bake_action(action, parts, run_frames, run_metadata):
    running = action == "running"
    keys = RUNNING if running else STANDING
    run_slices = {**dict(enumerate(range(6))), 18: 12, 19: 13} if running else {}
    frames, contacts, roots = [], [], []
    for index in range(FRAME_COUNT):
        if index in run_slices:
            run_index = run_slices[index]
            frame = run_frames[run_index]
            contact = run_metadata["footContactsByFrame"][run_index]
            rise = 0
        else:
            pose = interpolated(keys, index)
            frame, contact = render_pose(pose, parts)
            rise = pose.root_y
        frames.append(frame)
        contacts.append(contact)
        roots.append([16 * index if running else 0, rise])

    events = {"takeoff": 6, "apex": 10, "land": 14}
    if any(contacts[index] for index in range(events["takeoff"], events["land"])):
        raise ValueError("A flight frame has ground contact.")
    expected = {"right"} if running else {"left"}
    if {foot[0] for foot in contacts[events["takeoff"] - 1]} != expected:
        raise ValueError("The takeoff uses the wrong feet.")
    if {foot[0] for foot in contacts[events["land"]]} != {"left"}:
        raise ValueError("The landing uses the wrong feet.")
    if not running:
        for index in (events["takeoff"] - 2, events["land"] + 1):
            if {foot[0] for foot in contacts[index]} != {"left", "right"}:
                raise ValueError("Both feet must support the standing jump before and after its staggered contacts.")
    if min(range(FRAME_COUNT), key=lambda index: roots[index][1]) != events["apex"]:
        raise ValueError("The motion apex does not match the event.")

    output = ROOT / f"jump-{action}-{'v2' if running else 'v3'}"
    output.mkdir(exist_ok=True)
    atlas = Image.new("RGBA", (SIZE * COLUMNS, SIZE * (FRAME_COUNT // COLUMNS)))
    for index, frame in enumerate(frames):
        row, column = divmod(index, COLUMNS)
        atlas.paste(frame, (column * SIZE, row * SIZE))
    name = f"envy-jump-{action}"
    sheet = f"{name}-sheet.png"
    atlas.save(output / sheet, optimize=True)
    metadata = {
        "name": name,
        "spriteSheet": sheet,
        "facing": "right, three-quarter",
        "originPx": ORIGIN,
        "frameSize": [SIZE, SIZE],
        "columns": COLUMNS,
        "rows": FRAME_COUNT // COLUMNS,
        "frameCount": FRAME_COUNT,
        "frameDurationMs": FRAME_MS,
        "durationMs": FRAME_COUNT * FRAME_MS,
        "loop": False,
        "events": events,
        "footContactsByFrame": contacts,
        "previewRootOffsetsPx": roots,
        "poseReference": "../references/envy-jump-key-poses.png",
        "orientationReference": "../references/envy-turnaround-hood-fit.png",
    }
    if running:
        metadata["runTransition"] = {
            "source": "../run-v2/animation.json",
            "entrySourceFrames": [0, 1, 2, 3, 4, 5],
            "exitSourceFrames": [12, 13],
            "resumeSourceFrame": 14,
        }
    else:
        metadata["footEvents"] = {
            "right": {"lift": 5, "land": 15},
            "left": {"lift": 6, "land": 14},
        }
    (output / "animation.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return frames, roots


def preview(actions, out=ROOT / "jump-preview-v3.png"):
    boxes = []
    for frames, roots in actions:
        extents = []
        for frame, (x, y) in zip(frames, roots):
            left, top, right, bottom = frame.getchannel("A").getbbox()
            extents.append((left + x, top + y, right + x, bottom + y))
        boxes.append((min(b[0] for b in extents) - 12, min(b[1] for b in extents) - 8,
                      max(b[2] for b in extents) + 12, GROUND + 13))
    top = min(b[1] for b in boxes)
    panel_widths = [box[2] - box[0] for box in boxes]
    label_height = 32
    gutter = 5
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 16)
    images = []
    for frame_index in range(FRAME_COUNT):
        preview_frame = Image.new("RGB", (sum(panel_widths) + gutter * (len(actions) - 1), GROUND + 13 - top + label_height), "#f1f4fa")
        draw = ImageDraw.Draw(preview_frame)
        start = 0
        for (frames, roots), box, width, label in zip(actions, boxes, panel_widths, ("STANDING JUMP", "RUNNING JUMP")):
            draw.rectangle((start, 0, start + width - 1, preview_frame.height - 1), fill="#e3e9f3")
            draw.text((start + 10, 8), label, font=font, fill="#23324b")
            floor_y = GROUND - top + label_height
            draw.line((start + 5, floor_y, start + width - 6, floor_y), fill="#9baac0")
            frame = frames[frame_index]
            root_x, root_y = roots[frame_index]
            sprite = frame.crop(frame.getchannel("A").getbbox())
            left, y = frame.getchannel("A").getbbox()[:2]
            preview_frame.paste(sprite, (start + left + root_x - box[0], y + root_y - top + label_height), sprite)
            start += width + gutter
        images.append(preview_frame)
    images[0].save(out, save_all=True, append_images=images[1:],
                   duration=[FRAME_MS] * (FRAME_COUNT - 1) + [FRAME_MS + 420],
                   loop=0, disposal=0, blend=0, optimize=True)


if __name__ == "__main__":
    trousers, shoes = load_lower_body()
    upper, right_arm, left_arm = load_upper_parts()
    parts = trousers, shoes, upper, premultiply(upper), right_arm, left_arm
    run_frames, run_metadata = approved_run()
    preview([bake_action(name, parts, run_frames, run_metadata) for name in ("standing", "running")])
