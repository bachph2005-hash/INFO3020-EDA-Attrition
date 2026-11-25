"""Xuất PDF bằng LibreOffice, cập nhật mục lục tự động trước khi xuất.

Dùng:  python3 report/export_pdf.py <file.docx> <file.pdf>
Lưu ý: dàn trang của LibreOffice có thể lệch đôi chút so với Word; bản PDF chính thức nên xuất từ Word.
"""
import subprocess, sys, time, uno
from pathlib import Path
from com.sun.star.beans import PropertyValue


def prop(n, v):
    p = PropertyValue(); p.Name, p.Value = n, v; return p


def main(src, dst):
    proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--nologo", "--norestore",
                             "--accept=socket,host=localhost,port=2002;urp;"])
    try:
        ctx = uno.getComponentContext()
        res = ctx.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", ctx)
        for _ in range(60):
            try:
                c = res.resolve("uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"); break
            except Exception:
                time.sleep(0.5)
        desk = c.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", c)
        doc = desk.loadComponentFromURL(Path(src).resolve().as_uri(), "_blank", 0, (prop("Hidden", True),))
        idx = doc.getDocumentIndexes()
        n = idx.getCount()
        for i in range(n):
            idx.getByIndex(i).update()
        doc.refresh()
        doc.storeToURL(Path(dst).resolve().as_uri(), (prop("FilterName", "writer_pdf_Export"),))
        doc.close(True)
        print(f"Đã xuất {dst} (cập nhật {n} mục lục)")
    finally:
        proc.terminate()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
