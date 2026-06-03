import argparse
import base64
import mimetypes
from pathlib import Path

MAX_BASE64_BYTES = 1_000_000


def image_to_data_url(image_path: Path) -> str:
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a JPG/JPEG image to a base64 data URL for Firestore text fields."
    )
    parser.add_argument("image", type=Path, help="Path to the JPG/JPEG image.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Optional output .txt file. If omitted, prints to the terminal.",
    )
    args = parser.parse_args()

    if not args.image.exists():
        raise SystemExit(f"Image not found: {args.image}")

    data_url = image_to_data_url(args.image)

    if len(data_url.encode("utf-8")) > MAX_BASE64_BYTES:
        size = len(data_url.encode("utf-8"))
        raise SystemExit(
            f"Base64 data URL is too large ({size} bytes). "
            f"Keep it under {MAX_BASE64_BYTES} bytes for the macro/Firestore document."
        )

    if args.output:
        args.output.write_text(data_url, encoding="utf-8")
        print(f"Saved base64 data URL to: {args.output}")
    else:
        print(data_url)


if __name__ == "__main__":
    main()
