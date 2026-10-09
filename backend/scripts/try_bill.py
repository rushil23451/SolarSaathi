"""Read a real bill (or quote) with Claude on Bedrock from your laptop, then run the calculation.

Needs AWS credentials (`aws configure`) with Bedrock access. Nothing is uploaded to S3 and
nothing is stored.

    python scripts/try_bill.py ~/Desktop/bill_folder/bill1.webp
    python scripts/try_bill.py ~/Desktop/bill_folder/Scribd.pdf --lat 28.61 --lon 77.21
    python scripts/try_bill.py path/to/quote.jpg --quote
"""

import argparse
import json
import mimetypes
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from solarsaathi import calc, extract, irradiance, quote_rules  # noqa: E402

SUPPORTED = {"image/jpeg", "image/png", "image/webp", "application/pdf"}


def load(path: Path) -> tuple[bytes, str]:
    media_type = mimetypes.guess_type(path.name)[0] or ""
    if media_type in SUPPORTED:
        return path.read_bytes(), media_type
    # AVIF / HEIC: the model accepts JPEG, PNG, WebP, GIF and PDF. The web app converts in the
    # browser; here we use macOS's built-in `sips`.
    if not shutil.which("sips"):
        sys.exit(f"{path.suffix} is not supported; convert it to JPEG first")
    out = Path(tempfile.mkdtemp()) / (path.stem + ".jpg")
    subprocess.run(["sips", "-s", "format", "jpeg", str(path), "--out", str(out)], check=True, capture_output=True)
    return out.read_bytes(), "image/jpeg"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("file", type=Path)
    p.add_argument("--quote", action="store_true", help="the file is a vendor quote, not a bill")
    p.add_argument("--lat", type=float, default=28.61)
    p.add_argument("--lon", type=float, default=77.21)
    p.add_argument("--roof", default="unknown", choices=["small", "medium", "large", "unknown"])
    args = p.parse_args()

    data, media_type = load(args.file.expanduser())
    if args.quote:
        quote = extract.read_quote(data, media_type)
        print(json.dumps(quote, indent=2, ensure_ascii=False))
        print(json.dumps(quote_rules.run_all(quote, {}), indent=2))
        return

    bill = extract.read_bill(data, media_type)
    print("What the model read:\n" + json.dumps(bill, indent=2, ensure_ascii=False))
    result = calc.analyse(bill, irradiance.annual_ghi(args.lat, args.lon), args.roof)
    print("\nResult:\n" + json.dumps({k: v for k, v in result.items() if k != "working"}, indent=2))


if __name__ == "__main__":
    main()
