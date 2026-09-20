import fitz, sys, os
src=sys.argv[1]
out=sys.argv[2]
os.makedirs(out, exist_ok=True)
doc=fitz.open(src)
for i in range(min(2, doc.page_count)):
    pix=doc[i].get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False)
    pix.save(os.path.join(out, f'page-{i+1}.png'))
print(f'rendered {min(2, doc.page_count)} of {doc.page_count} pages')
