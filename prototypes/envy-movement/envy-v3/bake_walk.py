"""Bake the right-facing Envy walk from the master and the generated cutout sheet."""

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from bake_idle import idle_frame, ramp


ROOT = Path(__file__).resolve().parent
SIZE = 512
COUNT = 16
PERIOD_MS = 1200
COLUMNS = 4
STANCE = 0.625
STRIDE = 100
GROUND = 463


def read_parts(path):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    alpha = np.asarray(image.getchannel("A"))
    empty_rows = np.flatnonzero(np.max(alpha, axis=1) < 5)
    gap = empty_rows[(empty_rows > height * 0.5) & (empty_rows < height * 0.65)]
    if not gap.size:
        raise ValueError("The trousers and shoes must have a clear gutter.")
    row_edges = (0, int(np.median(gap)), height)
    parts = []
    for row, col in ((0, 0), (0, 1), (1, 0), (1, 1)):
        cell = image.crop((col * width // 2, row_edges[row],
                           (col + 1) * width // 2, row_edges[row + 1]))
        alpha = cell.getchannel("A").point(lambda value: value if value >= 5 else 0)
        cell.putalpha(alpha)
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError(f"Missing part in row {row}, column {col}")
        parts.append(cell.crop(bounds))
    return parts


def foot_pose(phase, center, *, stride=STRIDE, lift_height=24, heel_pitch=10, toe_pitch=12):
    half = stride * STANCE / 2
    if phase < STANCE:
        position = half - stride * phase
        landing = max(0, 1 - phase / 0.16)
        push = max(0, (phase - 0.45) / (STANCE - 0.45))
        return center + position, 0, heel_pitch * landing - toe_pitch * push, True
    flight = (phase - STANCE) / (1 - STANCE)
    ease = flight * flight * (3 - 2 * flight)
    lift = lift_height * math.sin(math.pi * flight)
    pitch = -toe_pitch + (heel_pitch + toe_pitch) * ease
    return center - half + 2 * half * ease, lift, pitch, False


def shoe_at(shoe, x, ground, lift, pitch):
    pivot = np.array([0.44 * shoe.width, 0.24 * shoe.height])
    margin = 36
    padded = Image.new("RGBA", (shoe.width + 2 * margin, shoe.height + 2 * margin))
    padded.paste(shoe, (margin, margin))
    pivot += margin
    rotated = padded.rotate(pitch, resample=Image.Resampling.BICUBIC, center=tuple(pivot))
    left, top, right, bottom = rotated.getchannel("A").getbbox()
    origin = (round(x - pivot[0]), round(ground - lift) - bottom)
    ankle = pivot + origin
    return rotated.crop((left, top, right, bottom)), (origin[0] + left, origin[1] + top), ankle


def knee_at(hip, ankle, thigh=67.0, shin=68.0):
    delta = ankle - hip
    distance = np.linalg.norm(delta)
    axis = delta / distance
    reach = min(distance, thigh + shin - 0.01)
    along = (reach * reach + thigh * thigh - shin * shin) / (2 * reach)
    height = math.sqrt(max(0, thigh * thigh - along * along))
    return hip + along * axis + height * np.array([axis[1], -axis[0]])


def premultiply(part):
    texture = np.array(part, dtype=np.float32)
    texture[:, :, :3] *= texture[:, :, 3:] / 255.0
    return texture


def sample_texture(texture, u, v):
    u = np.clip(u, 0, texture.shape[1] - 1)
    v = np.clip(v, 0, texture.shape[0] - 1)
    left, top = u.astype(int), v.astype(int)
    right = np.minimum(left + 1, texture.shape[1] - 1)
    bottom = np.minimum(top + 1, texture.shape[0] - 1)
    du, dv = (u - left)[:, None], (v - top)[:, None]
    upper = texture[top, left] * (1 - du) + texture[top, right] * du
    lower = texture[bottom, left] * (1 - du) + texture[bottom, right] * du
    pixels = upper * (1 - dv) + lower * dv
    alpha = pixels[:, 3:]
    np.divide(pixels[:, :3] * 255, alpha, out=pixels[:, :3], where=alpha > 0)
    return np.rint(pixels).clip(0, 255).astype(np.uint8)


def triangle(canvas, texture, dst, uv):
    minimum = np.maximum(np.floor(dst.min(axis=0)).astype(int), 0)
    maximum = np.minimum(np.ceil(dst.max(axis=0)).astype(int) + 1, SIZE)
    x0, y0 = minimum
    x1, y1 = maximum
    y, x = np.mgrid[y0:y1, x0:x1]
    direction = (dst[1:] - dst[0]).T
    if abs(np.linalg.det(direction)) < 1e-6:
        return
    local = np.stack((x - dst[0, 0], y - dst[0, 1]), axis=-1)
    b, c = np.moveaxis(local @ np.linalg.inv(direction).T, -1, 0)
    mask = (b >= -1e-6) & (c >= -1e-6) & (b + c <= 1 + 1e-6)
    coords = uv[0] + b[mask, None] * (uv[1] - uv[0]) + c[mask, None] * (uv[2] - uv[0])
    canvas[y0:y1, x0:x1][mask] = sample_texture(texture, coords[:, 0], coords[:, 1])


def pant_leg(texture, width, hip, knee, ankle):
    points = np.array([
        hip, hip * 0.5 + knee * 0.5, hip * 0.17 + knee * 0.83,
        hip * 0.05 + knee * 0.90 + ankle * 0.05,
        knee * 0.83 + ankle * 0.17, knee * 0.5 + ankle * 0.5, ankle,
    ])
    fractions = [0, 0.25, 0.415, 0.5, 0.585, 0.75, 1]
    tangent = np.gradient(points, axis=0)
    normal = np.stack((tangent[:, 1], -tangent[:, 0]), axis=-1)
    normal /= np.linalg.norm(normal, axis=1)[:, None]
    edges = np.stack((points - normal * width / 2, points + normal * width / 2), axis=1)
    canvas = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    tex_height, tex_width = texture.shape[:2]
    for index, (top, bottom) in enumerate(zip(fractions, fractions[1:])):
        quad = np.vstack((edges[index], edges[index + 1]))
        uv = np.array([[0, top], [tex_width - 1, top], [0, bottom], [tex_width - 1, bottom]])
        uv[:, 1] *= tex_height - 1
        for selection in ([0, 1, 2], [1, 3, 2]):
            triangle(canvas, texture, quad[selection], uv[selection])
    return Image.fromarray(canvas)


def upper_body_mask():
    # Mask follows the hem, hands, and console, which hang over the trousers.
    border = [
        (150, 45), (348, 45), (354, 300), (341, 343), (314, 345),
        (291, 345), (286, 325), (284, 315), (260, 312), (240, 318),
        (219, 314), (211, 321), (206, 336), (179, 338), (163, 305),
    ]
    mask = Image.new("L", (SIZE * 2, SIZE * 2))
    ImageDraw.Draw(mask).polygon([(x * 2, y * 2) for x, y in border], fill=255)
    return mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def swing_sleeves(rgba, phase):
    y, x = np.mgrid[217:352, 153:352].astype(np.float32)
    wrists = ramp(y, 219, 327)
    left = (1 - ramp(x, 202, 225)) * wrists
    right = ramp(x, 315, 332) * wrists
    swing = math.cos(math.tau * phase)
    sample_x = x + swing * (6 * left - 4 * right)
    sample_y = y + swing * (2 * left - 2 * right)
    texture = premultiply(rgba)
    rgba[217:352, 153:352] = sample_texture(
        texture, sample_x.ravel(), sample_y.ravel(),
    ).reshape((*x.shape, 4))


def bake(output):
    near_pants, far_pants, near_shoe, far_shoe = read_parts(ROOT / "walk-parts.png")
    part_textures = [premultiply(part.resize((88, 180), Image.Resampling.LANCZOS))
                     for part in (far_pants, near_pants)]
    shoes = [part.resize((58, 35), Image.Resampling.LANCZOS) for part in (far_shoe, near_shoe)]
    master = np.asarray(Image.open(ROOT / "master_rgba.png").convert("RGBA"))
    texture = premultiply(master)
    y, x = np.mgrid[112:710, 328:700].astype(np.float32)
    mask = np.asarray(upper_body_mask(), dtype=np.uint16)
    frames = []
    contacts = []
    for index in range(COUNT):
        phase = index / COUNT
        # The pelvis settles shortly after each landing and rises at passing.
        bob = round(3.5 * math.cos(math.tau * (2 * phase - 0.14)))
        frame = Image.new("RGBA", (SIZE, SIZE))
        frame_contacts = []
        for leg, hip_x, ground, phase_offset in ((0, 239, GROUND - 2, 0.5), (1, 265, GROUND, 0)):
            foot_x, lift, pitch, planted = foot_pose((phase + phase_offset) % 1, hip_x + 2)
            shoe, position, ankle = shoe_at(shoes[leg], foot_x, ground, lift, pitch)
            hip = np.array([hip_x, 304 + bob], dtype=float)
            knee = knee_at(hip, ankle)
            frame.alpha_composite(shoe, position)
            frame.alpha_composite(pant_leg(part_textures[leg], 60 if leg == 0 else 64, hip, knee, ankle))
            if planted:
                actual_ground = position[1] + shoe.getchannel("A").getbbox()[3]
                if actual_ground != ground:
                    raise ValueError("A planted shoe left its contact line.")
                frame_contacts.append(["far" if leg == 0 else "near", round(foot_x, 3), ground])

        torso = idle_frame(master, texture, x, y, math.tau * (2 * phase + 0.15))
        rgba = np.array(torso)
        rgba[..., 3] = ((rgba[..., 3].astype(np.uint16) * mask + 127) // 255).astype(np.uint8)
        swing_sleeves(rgba, phase)
        frame.alpha_composite(Image.fromarray(rgba), (0, bob))
        frames.append(frame)
        contacts.append(frame_contacts)

    export_walk(output, frames, contacts)


def export_locomotion(output, frames, contacts, *, action="walk", period_ms=PERIOD_MS,
                      stride=STRIDE, rig=None, art_source=None):
    if len(frames) != COUNT or len(contacts) != COUNT or len({frame.tobytes() for frame in frames}) != COUNT:
        raise ValueError("The cycle must contain 16 distinct poses and contact records.")
    if (action == "walk" and not all(contacts)) or (action == "run" and (all(contacts) or not any(contacts))):
        raise ValueError(f"Foot contact phases do not match {action}.")
    if any(not frame.getchannel("A").getbbox() or frame.getchannel("A").getbbox()[3] > GROUND for frame in frames):
        raise ValueError("A pose is empty or crosses the ground.")
    output.mkdir(exist_ok=True)
    rows = COUNT // COLUMNS
    sheet = Image.new("RGBA", (COLUMNS * SIZE, rows * SIZE))
    for index, frame in enumerate(frames):
        row, column = divmod(index, COLUMNS)
        sheet.paste(frame, (column * SIZE, row * SIZE))
    name = f"envy-{action}"
    sheet.save(output / f"{name}-sheet.png", optimize=True)
    duration = period_ms // COUNT
    frames[0].save(
        output / f"{name}-preview.png", save_all=True, append_images=frames[1:],
        duration=duration, loop=0, disposal=0, blend=0, optimize=True,
    )
    meta = {
        "name": name,
        "facing": "right, three-quarter",
        "originPx": [253.25, GROUND],
        "frameSize": [SIZE, SIZE],
        "spriteSheet": f"{name}-sheet.png",
        "columns": COLUMNS,
        "rows": rows,
        "frameCount": COUNT,
        "frameDurationMs": duration,
        "durationMs": period_ms,
        "loop": True,
        "artSource": art_source or "master sprite and ImageGen cutouts, animated by a two-bone leg rig",
        "suggestedTravelPerCyclePx": stride,
        "footContactsByFrame": contacts,
    }
    if rig is not None:
        meta["rig"] = rig
    (output / "animation.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def export_walk(output, frames, contacts, *, stride=STRIDE, rig=None):
    export_locomotion(output, frames, contacts, stride=stride, rig=rig)


if __name__ == "__main__":
    bake(ROOT / "walk")
