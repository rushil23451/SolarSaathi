"""Turn an uploaded document into the images we show the model.

Bills put their most important small print (the meter table and the consumption history) in
narrow table rows. On a phone photo those digits are only a few pixels tall, and models misread
them. Sending a zoomed copy of the lower half of the page alongside the full page fixed this in
our tests: Nova 2 Lite, Qwen3-VL and Kimi K2.5 all read the full history table of the sample
bill correctly with the zoom, and none of them did without it.

PDFs are rendered to an image first, so models that can't read PDFs (like Qwen3-VL) still can.
"""

import io
import logging

log = logging.getLogger(__name__)

MAX_SIDE = 2000  # what the phone app already sends; keeps requests small
ZOOM_FROM = 0.45  # the lower part of the page, where the history table usually is
ZOOM_WIDTH = 1600


def _to_jpeg(img) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def _open(data: bytes, media_type: str):
    from PIL import Image

    if media_type == "application/pdf":
        import pypdfium2 as pdfium

        page = pdfium.PdfDocument(data)[0]
        scale = MAX_SIDE / max(page.get_width(), page.get_height())
        return page.render(scale=scale).to_pil()
    return Image.open(io.BytesIO(data))


def bill_images(data: bytes, media_type: str) -> list[bytes] | None:
    """[full page, zoomed lower part] as JPEG bytes, or None if the document can't be opened
    (the caller then sends the original file as before)."""
    try:
        from PIL import Image

        img = _open(data, media_type)
        img.load()
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        w, h = img.size
        lower = img.crop((0, int(h * ZOOM_FROM), w, h))
        if lower.width < ZOOM_WIDTH:
            factor = ZOOM_WIDTH / lower.width
            lower = lower.resize((ZOOM_WIDTH, int(lower.height * factor)), Image.LANCZOS)
        return [_to_jpeg(img), _to_jpeg(lower)]
    except Exception:  # missing library, unreadable image or PDF
        log.exception("could not prepare page images; sending the original file")
        return None


def document_images(data: bytes, media_type: str, max_pages: int = 3) -> list[bytes] | None:
    """Each page as a JPEG (PDFs: up to max_pages), for models that can't read PDFs. None on failure."""
    try:
        if media_type == "application/pdf":
            import pypdfium2 as pdfium

            pdf = pdfium.PdfDocument(data)
            out = []
            for i in range(min(len(pdf), max_pages)):
                page = pdf[i]
                scale = MAX_SIDE / max(page.get_width(), page.get_height())
                out.append(_to_jpeg(page.render(scale=scale).to_pil()))
            return out
        img = _open(data, media_type)
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        return [_to_jpeg(img)]
    except Exception:
        log.exception("could not render the document; sending the original file")
        return None
