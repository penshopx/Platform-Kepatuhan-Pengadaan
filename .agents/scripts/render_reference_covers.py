from pathlib import Path
import fitz
from PIL import Image, ImageDraw

src = Path('attached_assets')
out = Path('.agents/outputs/reference-pages')
out.mkdir(parents=True, exist_ok=True)
thumbs = []
for pdf in sorted(src.glob('*.pdf')):
    doc = fitz.open(pdf)
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(1.1, 1.1), alpha=False)
    path = out / f'{pdf.stem[:42]}.png'
    pix.save(path)
    image = Image.open(path).convert('RGB')
    image.thumbnail((300, 210))
    card = Image.new('RGB', (320, 260), 'white')
    card.paste(image, ((320-image.width)//2, 8))
    d = ImageDraw.Draw(card)
    d.text((10, 225), pdf.stem[:42], fill='black')
    d.text((10, 242), f'{len(doc)} halaman', fill='#555')
    thumbs.append(card)
cols = 3
rows = (len(thumbs)+cols-1)//cols
sheet = Image.new('RGB', (cols*320, rows*260), '#dddddd')
for i, card in enumerate(thumbs):
    sheet.paste(card, ((i%cols)*320, (i//cols)*260))
sheet.save(out/'contact-sheet.png')
print(f'Rendered {len(thumbs)} covers to {out}/contact-sheet.png')
