"""Đổi mục lục gõ tay trong báo cáo thành mục lục tự động của Word (trường TOC).

Dùng:  python3 report/toc_field.py <file.docx> [file_ra.docx]

- Các dòng mục lục hiện có (từ dòng sau "MỤC LỤC" tới trước tiêu đề đầu tiên) được bọc trong trường
  TOC \\o "1-2" \\h \\z \\u, gán kiểu TOC 1 / TOC 2 (chữ đậm, dấu chấm dẫn tới số trang, cấp 2 thụt 0,5 cm).
- Số trang sẵn trong trường được tính lại theo vị trí ngắt trang Word ghi lần lưu gần nhất
  (w:lastRenderedPageBreak); trong Word, cập nhật trường để tính lại sau khi sửa nội dung.
"""
import re, shutil, sys, tempfile, zipfile
from pathlib import Path

TOC_STYLES = (
    '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/>'
    '<w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:tabs>'
    '<w:tab w:val="right" w:leader="dot" w:pos="9637"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="360" '
    'w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/>'
    '<w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:tabs>'
    '<w:tab w:val="right" w:leader="dot" w:pos="9637"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="360" '
    'w:lineRule="auto"/><w:ind w:left="284"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>'
)
PARA = re.compile(r"<w:p[ >].*?</w:p>", re.S)
text = lambda p: "".join(re.findall(r"<w:t[^>]*>([^<]*)", p))


def word_pages(body):
    """Số trang hiển thị của mỗi tiêu đề theo lần dàn trang gần nhất của Word (bìa = 0)."""
    page, out = 1, {}
    for p in PARA.findall(body):
        n = p.count("<w:lastRenderedPageBreak/>") + p.count('w:type="page"')
        if re.search(r'<w:pStyle w:val="Heading[12]"', p):
            out.setdefault(text(p), page + n - 2)
        page += n
    return out


def convert(src, dst):
    tmpd = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(src) as z:
        z.extractall(tmpd)
    docp, styp = tmpd / "word/document.xml", tmpd / "word/styles.xml"
    d = docp.read_text(encoding="utf-8")
    assert "TOC \\o" not in d, "file đã có mục lục tự động"
    paras = list(PARA.finditer(d))
    k = next(i for i, m in enumerate(paras) if text(m.group(0)).strip() == "MỤC LỤC")
    rows = []
    for m in paras[k + 1:]:
        if "<w:pStyle" in m.group(0):
            break
        rows.append(m)
    pages = word_pages(d)
    has_lrpb = "<w:lastRenderedPageBreak/>" in d
    new = []
    for i, m in enumerate(rows):
        p = m.group(0)
        lvl = 2 if '<w:ind w:left="284"/>' in p else 1
        full = "".join(re.findall(r"<w:t[^>]*>([^<]*)", p.replace("<w:tab/>", "<w:t>\t</w:t>")))
        title, _, old = full.partition("\t")
        title, old = title.strip(), old.strip()
        num = str(pages.get(title, old)) if has_lrpb else old
        head = ('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u '
                '</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>') if i == 0 else ""
        tail = '<w:r><w:fldChar w:fldCharType="end"/></w:r>' if i == len(rows) - 1 else ""
        new.append(f'<w:p><w:pPr><w:pStyle w:val="TOC{lvl}"/></w:pPr>{head}<w:r><w:t xml:space="preserve">{title}</w:t></w:r>'
                   f'<w:r><w:tab/></w:r><w:r><w:t>{num}</w:t></w:r>{tail}</w:p>')
    d = d[:rows[0].start()] + "".join(new) + d[rows[-1].end():]
    docp.write_text(d, encoding="utf-8")
    s = styp.read_text(encoding="utf-8")
    if 'w:styleId="TOC1"' not in s:
        s = s.replace("</w:styles>", TOC_STYLES + "</w:styles>")
        styp.write_text(s, encoding="utf-8")
    out = Path(dst).with_suffix(".tmp.zip")
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            zout.writestr(item, b"" if item.is_dir() else (tmpd / item.filename).read_bytes())
    shutil.move(out, dst)
    shutil.rmtree(tmpd)
    return len(rows), has_lrpb


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    n, lr = convert(src, dst)
    print(f"Đã đổi {n} dòng mục lục thành trường TOC; số trang theo {'dàn trang của Word' if lr else 'số trang cũ'}.")
