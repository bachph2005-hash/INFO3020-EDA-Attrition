"""Hoàn thiện báo cáo theo mẫu CMC: chèn trang bìa (khung viền + logo) và điền số trang mục lục.

Chạy từ thư mục gốc dự án:  python3 report/cmc_cover.py
Script gọi build_final_report.js, chèn bìa từ report/cmc_template/, xuất PDF bằng LibreOffice,
đo số trang của từng tiêu đề, ghi report/toc_pages.json rồi dựng lại cho tới khi mục lục khớp.
"""
import json, re, shutil, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REP = ROOT / "report"
TPL = REP / "cmc_template"
DOCX = REP / "BaoCao_BaiTapLon_PhanHoangBach.docx"
PDF = DOCX.with_suffix(".pdf")
TOCJ = REP / "toc_pages.json"


def build():
    subprocess.run(["node", str(REP / "build_final_report.js"), str(REP / "tables.json")], check=True, cwd=ROOT)
    inject_cover()
    sys.path.insert(0, str(REP)); import toc_field; toc_field.convert(DOCX, DOCX)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(REP), str(DOCX)],
                   check=True, capture_output=True)


def inject_cover():
    tmp = DOCX.with_suffix(".tmp.docx")
    cover = (TPL / "cover_cmc.xml").read_text(encoding="utf-8")
    with zipfile.ZipFile(DOCX) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                x = data.decode("utf-8")
                # đoạn giữ chỗ %%COVER%% + đoạn ngắt trang ngay sau (bìa mẫu đã có ngắt trang riêng)
                m = re.search(r"<w:p>(?:(?!<w:p>).)*?%+COVER%+.*?</w:p><w:p>(?:(?!<w:p>).)*?<w:br w:type=\"page\"/>.*?</w:p>", x, re.S)
                assert m, "không thấy chỗ giữ chỗ trang bìa"
                x = x[:m.start()] + cover + x[m.end():]
                data = x.encode("utf-8")
            elif item.filename == "word/_rels/document.xml.rels":
                x = data.decode("utf-8")
                x = x.replace("</Relationships>", '<Relationship Id="rIdCmcLogo" Type="http://schemas.openxmlformats.org/'
                              'officeDocument/2006/relationships/image" Target="media/logo_cmc.jpeg"/></Relationships>')
                data = x.encode("utf-8")
            zout.writestr(item, data)
        zout.write(TPL / "logo_cmc.jpeg", "word/media/logo_cmc.jpeg")
    shutil.move(tmp, DOCX)


def measure():
    """Số trang hiển thị của mỗi tiêu đề: trang vật lý − 1 (bìa không đánh số, mục lục là trang 1)."""
    txt = subprocess.run(["pdftotext", "-layout", str(PDF), "-"], capture_output=True, text=True, check=True).stdout
    pages = txt.split("\f")
    heads = json.loads(subprocess.run(["node", "-e", HEADS_JS], capture_output=True, text=True, cwd=ROOT, check=True).stdout)
    norm = lambda s: re.sub(r"\s+", " ", s).strip()
    out, start = {}, 2  # bỏ qua bìa và mục lục
    for lv, h in heads:
        for i in range(start, len(pages)):
            lines = [norm(l) for l in pages[i].splitlines()]
            if any(l.startswith(norm(h)) for l in lines):
                out[h] = i  # trang vật lý i+1 → số hiển thị i
                start = i
                break
        else:
            print("Không tìm thấy:", h, file=sys.stderr)
    return out


# lấy danh sách tiêu đề theo đúng cách build_final_report.js tạo
HEADS_JS = r"""
const src = require('fs').readFileSync('report/build_final_report.js', 'utf8');
const re = /C\.push\(H([12])\("([^"]+)"\)\)/g; let m; const out = [];
while ((m = re.exec(src))) out.push([+m[1], m[1] === '1' ? m[2].toLocaleUpperCase('vi-VN') : m[2]]);
console.log(JSON.stringify(out));
"""

if __name__ == "__main__":
    for it in range(4):
        build()
        pages = measure()
        old = json.loads(TOCJ.read_text(encoding="utf-8")) if TOCJ.exists() else {}
        TOCJ.write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding="utf-8")
        if pages == old:
            print(f"Mục lục khớp sau {it + 1} lần dựng. Số trang PDF:",
                  subprocess.run(["pdfinfo", str(PDF)], capture_output=True, text=True).stdout.split("Pages:")[1].split()[0])
            break
