// Tạo báo cáo BÀI TẬP LỚN (.docx) — chạy: node report/build_final_report.js (từ thư mục gốc dự án)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, AlignmentType,
  HeadingLevel, WidthType, ShadingType, BorderStyle, LevelFormat, Footer, PageNumber, PageBreak, TabStopType, LeaderType,
} = require("docx");
const TOC_PAGES = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "toc_pages.json"), "utf8")); } catch (e) { return {}; } })();
const TOC = []; // [cấp, tiêu đề]

const ROOT = path.resolve(__dirname, "..");
const T = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, "tables.json"), "utf8"));
const FIG = (f) => fs.readFileSync(path.join(ROOT, "outputs", "figures", f));

const FONT = "Times New Roman";
const PAGE_W = 11906, MARGIN_L = 1418, MARGIN_R = 851; // A4 theo mẫu CMC: trên/dưới 2,0cm, trái 2,5cm, phải 1,5cm
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 9637 DXA ≈ 17cm
const HEAD_FILL = "DEEBF7";
const ACCENT = "C2410C";

// ---------- helpers ----------
function runs(text, base = {}) {
  // **đậm** và *nghiêng* đơn giản
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...base }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { before: 60, after: 60, line: 360 }, indent: opts.noIndent ? undefined : { firstLine: 567 }, ...(opts.para || {}) });
const H1 = (t) => { const u = t.toLocaleUpperCase("vi-VN"); TOC.push([1, u]); return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(u)] }); };
const H2 = (t) => { TOC.push([2, t]); return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); };
const B = (text, level = 0) => new Paragraph({ numbering: { reference: "bul", level }, children: runs(text),
  alignment: AlignmentType.JUSTIFIED, spacing: { before: 40, after: 40, line: 360 } });
const N = (text) => new Paragraph({ numbering: { reference: "num", level: 0 }, children: runs(text),
  alignment: AlignmentType.JUSTIFIED, spacing: { before: 60, after: 60, line: 360 } });
const caption = (t) => new Paragraph({ children: runs(t, { italics: true }),
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200, line: 360 } });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function img(file, widthCm, ratio) {
  const w = Math.round(widthCm * 37.8); // px ở 96dpi
  return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
    children: [new ImageRun({ type: "png", data: FIG(file), transformation: { width: w, height: Math.round(w * ratio) },
      altText: { title: file, description: file, name: file } })] });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(header, rows, widths, opts = {}) {
  const fs_ = opts.size || 24; // 12pt theo mẫu
  const sum = widths.reduce((a, b) => a + b, 0);
  const W = widths.map((w) => Math.round((w / sum) * CONTENT_W));
  W[W.length - 1] += CONTENT_W - W.reduce((a, b) => a + b, 0);
  const cell = (txt, i, head, rowOpts = {}) => new TableCell({
    borders, width: { size: W[i], type: WidthType.DXA },
    shading: head ? { fill: HEAD_FILL, type: ShadingType.CLEAR, color: "auto" } : rowOpts.fill ? { fill: rowOpts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: head ? AlignmentType.CENTER : (opts.align && opts.align[i]) || AlignmentType.LEFT,
      spacing: { before: 40, after: 40, line: 240 }, children: [new TextRun({ text: String(txt), size: fs_, bold: head || undefined })] })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: W,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, { fill: opts.highlight && opts.highlight(r, ri) ? "F2F2F2" : undefined })) }))],
  });
}
const vn = (x, d = 2) => { const n = Number(x); if (Number.isNaN(n)) return x; return n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }); };
const spacer = () => new Paragraph({ spacing: { before: 0, after: 60 }, children: [] });

const M = JSON.parse(fs.readFileSync(path.join(__dirname, "model_results.json"), "utf8"));
const pct = (x, d = 1) => (Number(x) * 100).toFixed(d).replace(".", ",") + "%";
const dec = (x, d = 2) => Number(x).toFixed(d).replace(".", ",");
const TS = M.test_scores;
const CM = M.cm;
const THR = dec(M.threshold, 2);
const SC = Object.fromEntries(M.scen.index.map((k, i) => [k, M.scen.rows[i]]));
const CVR = Object.fromEntries(M.cv.index.map((k, i) => [k, M.cv.rows[i]]));
const LR = CVR["Hồi quy logistic"], RF = CVR["Random Forest"], BASE = CVR["Mốc: luôn đoán “không nghỉ”"];
const box = (title, text) => new Paragraph({ spacing: { before: 120, after: 120, line: 360 }, alignment: AlignmentType.JUSTIFIED, indent: { left: 400, right: 400 },
  shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: "7F7F7F", space: 8 } },
  children: [new TextRun({ text: title, bold: true }), ...runs(text)] });

// ---------- nội dung ----------
const C = [];

// Trang bìa: chỗ giữ chỗ, script cmc_cover.py thay bằng bìa mẫu CMC (khung viền + logo)
C.push(new Paragraph({ children: [new TextRun("%COVER%")] }));
C.push(new Paragraph({ children: [new PageBreak()] }));
// Mục lục: dựng sau khi biết đủ tiêu đề (xem cuối file)
const TOC_AT = C.length;

C.push(H1("Tóm tắt"));
C.push(P(`Dự án phân tích 1.470 nhân viên (237 người, 16,1%, đã nghỉ việc) để trả lời hai câu hỏi: yếu tố nào đi kèm nghỉ việc khi đã so sánh công bằng trong cùng cấp bậc, và có phát hiện sớm được người có nguy cơ nghỉ không. Làm thêm giờ (30,5% so với 10,4%) và năm đầu làm việc (34,9%) là hai tín hiệu vững nhất, đã qua kiểm định thống kê; chênh lệch thu nhập phần lớn là do cấp bậc. Mô hình hồi quy logistic phát hiện ${pct(TS.Recall, 0)} người nghỉ trên tập kiểm tra giữ riêng, mỗi cảnh báo trúng gấp ${dec(TS.Precision / 0.16, 1)} lần chọn ngẫu nhiên. Sản phẩm đầu ra gồm danh sách nhân viên nguy cơ cao, bản đồ nguy cơ theo phòng ban và cấp bậc, và kịch bản mô phỏng chính sách. Mọi kết quả là mối liên hệ trong dữ liệu giả lập, không phải quan hệ nhân quả.`));

// ===== 1. GIỚI THIỆU CHUNG
C.push(H1("1. Giới thiệu chung"));
C.push(H2("1.1. Lý do chọn đề tài"));
C.push(P("Mỗi nhân viên nghỉ việc kéo theo chi phí tuyển dụng, đào tạo người thay thế và thời gian để người mới đạt năng suất. Phòng Nhân sự thường có ngân sách giới hạn cho các chương trình giữ chân (điều chỉnh làm thêm giờ, kèm cặp nhân viên mới, chính sách lương và cổ phiếu); nếu dàn trải cho toàn bộ nhân viên, chương trình sẽ mỏng và khó đo hiệu quả. Bài toán thực tế vì vậy là: **biết nhóm nào, người nào có nguy cơ nghỉ cao để ưu tiên nguồn lực**."));
C.push(P("Người dùng chính của sản phẩm là **Trưởng phòng Nhân sự** và Ban Giám đốc. Phân tích phục vụ quyết định: *nên ưu tiên nhóm nhân viên nào và đòn bẩy nào cho đợt chương trình giữ chân tiếp theo.*"));
C.push(box("Câu hỏi nghiên cứu: ", "*(1) Nhóm nhân viên nào có tỷ lệ nghỉ việc cao nhất, và yếu tố nào vẫn gắn với nghỉ việc khi so sánh trong cùng cấp bậc? (2) Có thể dự đoán người có nguy cơ nghỉ đủ tốt để phòng Nhân sự ưu tiên hỗ trợ không?*"));
C.push(H2("1.2. Mục tiêu và phạm vi thực hiện"));
C.push(B("**Phân tích và xử lý:** đánh giá chất lượng, làm sạch có nhật ký, xử lý ngoại lai, chuẩn hoá và mã hoá dữ liệu; phân tích khám phá (EDA) theo nhóm, kiểm tra biến gây nhiễu và kiểm định giả thuyết."));
C.push(B("**Mô hình hoá:** bài toán **phân loại nhị phân** (nghỉ / ở lại). So sánh mô hình mốc, hồi quy logistic và Random Forest; chọn độ đo theo nghiệp vụ; đánh giá trên tập kiểm tra giữ riêng."));
C.push(B("**Phương pháp thể hiện:** báo cáo phân tích tri thức (Data Insights) với năm biểu đồ chính có tiêu đề kết luận, và ba sản phẩm đầu ra trong notebook (Mục 3.1)."));
C.push(B("**Phạm vi:** dữ liệu là ảnh chụp tại một thời điểm, do IBM tạo ra (giả lập). Báo cáo nêu **mối liên hệ (association)**, không khẳng định nhân quả; kết quả là giả thuyết cần kiểm chứng trên dữ liệu thật của doanh nghiệp."));
C.push(H2("1.3. Ý nghĩa và ứng dụng thực tế"));
C.push(P("Kết quả giúp phòng Nhân sự (i) biết **đòn bẩy nào đáng thử trước** — giảm làm thêm giờ ở nhân viên cấp 1, chương trình hội nhập năm đầu cho người trẻ; (ii) tránh **quyết định sai** như tăng lương chung, vì chênh lệch thu nhập phần lớn là cái bóng của cấp bậc; (iii) có **danh sách ưu tiên trao đổi** hằng kỳ do mô hình chấm điểm. Quy trình (làm sạch → EDA → mô hình → đánh giá theo nhóm) dùng lại được khi doanh nghiệp có dữ liệu nhân sự thật."));

// ===== 2. PHÂN TÍCH BÀI TOÁN
C.push(H1("2. Phân tích bài toán thực tế"));
// a
C.push(H2("2.1. Thu thập dữ liệu: nguồn, cấu trúc và định dạng"));
C.push(P("**Nguồn.** Bộ dữ liệu công khai *IBM HR Analytics Employee Attrition & Performance*, tải từ Kaggle (pavansubhasht/ibm-hr-analytics-attrition-dataset); bản tương tự có trên OpenML (ID 43696). Theo mô tả gốc, đây là **dữ liệu giả lập do các nhà khoa học dữ liệu của IBM tạo ra**, không phải hồ sơ nhân sự của một công ty thật. Phương pháp thu thập: tải file CSV từ nguồn công khai, không dùng API hay web scraping."));
C.push(P("**Cấu trúc và định dạng.** File EmployeeAttrition.csv: 1.470 dòng × 35 cột, mã hoá UTF-8 có BOM, dấu phân cách là dấu phẩy; 26 cột số và 9 cột chữ, không có cột ngày tháng. Dung lượng khoảng 0,2 MB, Pandas đọc trong chưa tới một giây — **không cần công cụ dữ liệu lớn như Spark** (Tuần 12). Nguồn không công bố thời điểm thu thập: “Attrition = Yes” không rõ được tính trong khoảng thời gian bao lâu (Mục 3.2)."));
C.push(P("**Đánh giá chất lượng theo 6 chiều (Tuần 3), thang 1–5:** đầy đủ 5 (0 ô trống, 0 giá trị thiếu trá hình); không trùng 5; đúng miền 5; nhất quán 4 (197 dòng NumCompaniesWorked = 0 mâu thuẫn); chính xác 3 (ba cột DailyRate, HourlyRate, MonthlyRate không khớp thu nhập; thu nhập không ghi đơn vị tiền); kịp thời 2 (không rõ thời điểm)."));
const dd = T.data_dictionary.rows.map((r) => [r[0], r[1], r[2], r[3], r[5]]);
C.push(table(["Cột", "Kiểu", "Đơn vị", "Mô tả", "Số giá trị"], dd, [2.4, 1.0, 1.3, 4.6, 1.0], { size: 22, align: [null, null, null, null, AlignmentType.CENTER] }));
C.push(caption("Bảng 1. Từ điển dữ liệu — 35 cột gốc, nguồn IBM HR Analytics (Kaggle/OpenML). Không cột nào có giá trị thiếu."));

// b
C.push(H2("2.2. Làm sạch và biến đổi dữ liệu"));
C.push(P("Mỗi bước được thực hiện bằng code trong notebook (mục 2–3) và ghi vào bảng nhật ký. File gốc không bị sửa; **không dòng nào bị xoá**. Các quyết định *không can thiệp* (B2, B3, B8, B11, B12) cũng được ghi kèm cách xác minh."));
const SHORT = { "11": ["MonthlyIncome", "IQR: 114 dòng > 16.581; Z cải tiến: 118; Z-score: 0", "Giữ; dùng trung vị, Spearman, so trong cùng cấp", "Cả 114 là cấp 4–5, không ai vượt khung lương của cấp; bỏ đi không đổi kết luận"],
  "12": ["10 cột số còn lại", "IQR đánh dấu ở 7 cột (14–238 điểm/cột); Age, DistanceFromHome, PercentSalaryHike: 0", "Giữ toàn bộ", "Không có giá trị không thể có; TrainingTimesLastYear bị đánh dấu do Q1–Q3 quá hẹp"] };
const log = T.cleaning_log.rows.map((r) => SHORT[r[0]] ? ["B" + r[0], SHORT[r[0]][0], SHORT[r[0]][1], SHORT[r[0]][2], r[4], SHORT[r[0]][3]] : ["B" + r[0], r[1], r[2], r[3], r[4], r[5]]);
C.push(table(["Bước", "Cột", "Phát hiện", "Hành động", "Số dòng", "Lý do / cách xác minh"], log, [0.8, 1.7, 2.5, 2.0, 0.9, 3.0],
  { size: 22, align: [AlignmentType.CENTER, null, null, null, AlignmentType.CENTER, null], highlight: (r) => ["B9", "B10", "B11"].includes(r[0]) }));
C.push(caption("Bảng 2. Nhật ký làm sạch. Tô màu: ba quyết định cần lập luận nhiều nhất. “Số dòng” là số dòng bị tác động hoặc được đánh dấu."));
C.push(B("**Giá trị thiếu (B2).** Không có ô trống, không có giá trị thiếu trá hình (đã quét “N/A”, “-”, “?”, “unknown”, mã −999). Vì không thiếu nên không xếp được cơ chế MCAR/MAR/MNAR và không cần điền."));
C.push(B("**NumCompaniesWorked = 0 (B9).** Cả 197 người đều có tổng năm đi làm lớn hơn năm tại công ty **đúng 1 năm** — dấu hiệu lỗi mã hoá có hệ thống nhưng không có tài liệu để xác minh. Chọn **gắn cờ NCW_flag thay vì sửa** (sửa là đoán; xoá là mất 13% dữ liệu đúng ở cột khác)."));
C.push(B("**Ba cột Rate (B10).** Phân phối đều, gần như không tương quan với thu nhập (|ρ| ≤ 0,05) và không tăng theo cấp bậc — vô lý về nghiệp vụ, nên giữ trong file nhưng **loại khỏi phân tích và mô hình**."));
C.push(B("**Ba cột hằng số (B4).** EmployeeCount, Over18, StandardHours chỉ có một giá trị nên bị loại; hệ quả là dữ liệu không có số giờ làm thực tế."));

C.push(P("**Xử lý ngoại lai (outlier).** Làm theo trình tự Tuần 4: nhìn (boxplot), phát hiện bằng ba phương pháp, điều tra, quyết định, kiểm tra ảnh hưởng."));
const OD = { MonthlyIncome: "Giữ — toàn bộ là lương cấp 4–5", TotalWorkingYears: "Giữ — người đi làm lâu", YearsAtCompany: "Giữ — gắn bó lâu, qua kiểm tra logic",
  YearsInCurrentRole: "Giữ", YearsSinceLastPromotion: "Giữ — 95% có thâm niên ≥ 10 năm", YearsWithCurrManager: "Giữ",
  NumCompaniesWorked: "Giữ; không dùng để kết luận (17 người 9 công ty < 9 năm đi làm)", TrainingTimesLastYear: "Giữ — do Q1–Q3 quá hẹp, không phải ngoại lai",
  PercentSalaryHike: "Giữ — 25% là mức trần của thang", Age: "Không có", DistanceFromHome: "Không có" };
const orows = T.outliers.rows.filter((r) => !["Age", "DistanceFromHome"].includes(r[0])).map((r) => [r[0], vn(r[4], 2), String(r[5]), String(r[6]), String(r[7]), String(r[8]), OD[r[0]]]);
C.push(table(["Cột", "Skewness", "Z-score |z| > 3", "Z cải tiến |M| > 3,5", "IQR × 1,5", "IQR × 3", "Quyết định"], orows, [2.4, 0.9, 0.9, 1.0, 0.8, 0.7, 3.6],
  { size: 22, align: [null, AlignmentType.RIGHT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, null], highlight: (r) => r[0] === "MonthlyIncome" }));
C.push(caption("Bảng 3. Số điểm bị đánh dấu là ngoại lai theo ba phương pháp (Z cải tiến dùng trung vị và MAD). Age và DistanceFromHome: 0 điểm ở cả ba phương pháp."));
C.push(B("**Không có giá trị “không thể có”** (tuổi 18–65, thu nhập > 0, số năm ≥ 0, tổng năm đi làm ≤ tuổi − 14, tăng lương 0–100%: 0 vi phạm), nên không có căn cứ xoá."));
C.push(B("**Ba phương pháp khác nhau:** với thu nhập, Z-score không đánh dấu ai vì phân phối lệch phải (skewness 1,37) làm độ lệch chuẩn phình to, che lấp điểm cực trị; Z cải tiến và IQR đánh dấu 118 và 114 người. Trên thang rời rạc hẹp, IQR đánh dấu 238 người đào tạo 0, 5, 6 lần chỉ vì Q1 = 2, Q3 = 3 — giới hạn của quy tắc, không phải ngoại lai thật."));
C.push(img("figB_outlier_income_level.png", 10.0, 0.65));
C.push(caption("Hình 1. Thu nhập tháng theo cấp bậc; chấm cam là 114 người bị quy tắc IQR toàn công ty đánh dấu. Nguồn: IBM HR Attrition, n = 1.470."));
const im = Object.fromEntries(T.outlier_impact.rows.map((r) => [r[0], r]));
C.push(B(`**Điều tra và kiểm tra ảnh hưởng.** Cả 114 ngoại lai thu nhập đều là cấp 4 và cấp 5 — lương quản lý thật (Hình 1). Bỏ toàn bộ ${im["Số dòng"][3] * -1} dòng ngoại lai ở bốn cột chính rồi tính lại: làm thêm giờ ${vn(im["Làm thêm giờ: Có (%)"][1], 1)}% / ${vn(im["Làm thêm giờ: Không (%)"][1], 1)}% thành ${vn(im["Làm thêm giờ: Có (%)"][2], 1)}% / ${vn(im["Làm thêm giờ: Không (%)"][2], 1)}%; thâm niên 0–1 năm ${vn(im["Thâm niên 0–1 năm (%)"][1], 1)}% thành ${vn(im["Thâm niên 0–1 năm (%)"][2], 1)}% — **không kết luận nào đổi chiều**. Chỉ trung bình thu nhập giảm mạnh (${vn(im["Thu nhập: trung bình"][1], 0)} còn ${vn(im["Thu nhập: trung bình"][2], 0)}), trung vị giảm ít hơn — lý do báo cáo dùng trung vị.`));
C.push(B("**Quyết định: giữ toàn bộ, đổi công cụ thay vì đổi dữ liệu** — dùng trung vị, tương quan Spearman, chia nhóm và so sánh trong cùng cấp. Đã thử chặn trần 1%–99% (chạm 30 dòng, trung bình gần như không đổi) và biến đổi log (skewness 1,37 → 0,29) để so sánh, nhưng không áp dụng."));

C.push(P("**Biến đổi và chuẩn hoá cho mô hình.** Toàn bộ nằm trong một Pipeline của Scikit-learn để chỉ học tham số từ tập huấn luyện (tránh rò rỉ dữ liệu, Mục 2.4):"));
C.push(B("**Chuẩn hoá** 27 biến số bằng StandardScaler (trừ trung bình, chia độ lệch chuẩn) để hệ số hồi quy logistic so sánh được với nhau và thuật toán hội tụ ổn định."));
C.push(B("**Mã hoá** 6 biến phân loại bằng OneHotEncoder (mỗi giá trị thành một cột 0/1; biến hai giá trị chỉ giữ một cột)."));
C.push(B("**Sáu đặc trưng mới** (Tuần 11): số năm bình quân mỗi nơi làm; tỷ lệ sự nghiệp ở công ty này; thu nhập so với trung vị cùng cấp (trung vị học từ tập huấn luyện); phần thời gian chưa được thăng chức; mức hài lòng trung bình; cờ “làm thêm giờ và cấp 1”."));

// c
C.push(H2("2.3. Phân tích khám phá (EDA) và trực quan hoá"));
C.push(P("**Thống kê mô tả đủ bốn nhóm** (vị trí, phân tán, hình dạng, quan hệ — Tuần 6). Thu nhập lệch phải rõ rệt: trung bình 6.503 cao hơn trung vị 4.919 tới 32%, p90 gấp 5,9 lần p10. Thâm niên trung vị 5 năm nhưng đuôi dài tới 40 năm. Lớp “nghỉ việc” chỉ chiếm 16,1% — dữ liệu **mất cân bằng**, điều quyết định cách đánh giá mô hình ở Mục 2.4."));
const ds = T.descriptive_stats.rows.map((r) => [r[0], vn(r[1], 1), vn(r[2], 0), vn(r[3], 0), vn(r[4], 0), vn(r[5], 1), vn(r[6], 0), vn(r[7], 2), vn(r[8], 2), vn(r[9], 2), r[10]]);
C.push(table(["Biến", "TB", "Trung vị", "p10", "p90", "ĐLC", "IQR", "CV", "Skew", "Kurt", "Nên dùng"], ds, [2.6, 0.9, 0.9, 0.8, 0.8, 0.9, 0.8, 0.7, 0.7, 0.7, 1.1],
  { size: 20, align: [null, ...Array(9).fill(AlignmentType.RIGHT), AlignmentType.CENTER], highlight: (r) => r[0] === "MonthlyIncome" || r[0] === "YearsAtCompany" }));
C.push(caption("Bảng 4. Thống kê mô tả (n = 1.470). TB = trung bình, ĐLC = độ lệch chuẩn. “Nên dùng”: trung vị khi |skewness| > 1."));
C.push(img("fig0_correlation.png", 9.5, 0.90));
C.push(caption("Hình 2. Ma trận tương quan Spearman. Thu nhập – cấp bậc – tổng năm làm đi cùng nhau (ρ 0,71–0,92); không biến nào một mình có |ρ| với nghỉ việc quá 0,20. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("Vì thu nhập, cấp bậc, tuổi, thâm niên đi cùng nhau, một chênh lệch theo một biến có thể là ảnh hưởng của biến khác trong cụm. Mọi phát hiện dưới đây vì vậy được **kiểm tra lại trong từng nhóm con** — ý nghĩa của cụm từ “so sánh trong cùng cấp bậc” trong câu hỏi nghiên cứu."));
C.push(img("fig1_overtime_by_level.png", 12.5, 0.638));
C.push(caption("Hình 3. Tỷ lệ nghỉ việc theo làm thêm giờ trong từng cấp bậc. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Làm thêm giờ:** 30,5% so với 10,4% (gấp 2,9 lần). Tỷ lệ làm thêm giờ gần như bằng nhau ở mọi cấp (26–31%), và trong từng cấp người làm thêm giờ vẫn nghỉ nhiều hơn — rõ nhất ở cấp 1 (53% so với 16%). Chênh lệch còn nguyên khi tách theo tuổi, phòng ban, mức thu nhập: phát hiện **vững nhất**."));
C.push(img("fig2_tenure.png", 12.0, 0.548));
C.push(caption("Hình 4. Tỷ lệ nghỉ việc theo thâm niên tại công ty. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Thâm niên:** 34,9% người có thâm niên 0–1 năm đã nghỉ, giảm còn 8,1% ở nhóm trên 10 năm. Hiệu ứng tập trung ở người trẻ (55% ở 18–29 tuổi, 14% ở 40–60 tuổi) — “mới vào” và “còn trẻ” cộng hưởng."));
C.push(img("fig3_income_vs_level.png", 14.5, 0.56));
C.push(caption("Hình 5. (a) Tỷ lệ nghỉ theo tứ phân vị thu nhập; (b) thu nhập trung vị người nghỉ và người ở lại trong từng cấp. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Thu nhập — ví dụ về biến gây nhiễu:** nhóm thu nhập thấp nhất nghỉ 29,3%, người nghỉ có thu nhập trung vị thấp hơn 38%. Nhưng 96% nhóm này là cấp 1 và thu nhập tương quan với cấp bậc ρ = 0,92; so trong cùng cấp, chênh lệch chỉ còn 0 đến −10%. Thu nhập thấp đi kèm nghỉ việc **chủ yếu vì nó đi kèm cấp bậc thấp**."));
C.push(img("fig4_jobrole.png", 12.5, 0.55));
C.push(caption("Hình 6. Tỷ lệ nghỉ việc theo chức danh, kèm cỡ mẫu. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Chức danh:** Sales Representative nghỉ 39,8% (33/83), gấp 16 lần Research Director — nhưng là nhóm trẻ nhất (tuổi trung vị 30), 92% ở cấp 1, cỡ mẫu nhỏ (±5 người nghỉ ≈ ±6 điểm %). Biểu đồ chỉ ra nơi cần khảo sát, không chứng minh nguyên nhân."));
C.push(img("fig5_marital_age.png", 11.0, 0.635));
C.push(caption("Hình 7. Tỷ lệ nghỉ việc theo tình trạng hôn nhân và nhóm tuổi. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Tình trạng hôn nhân:** người độc thân nghỉ gần gấp đôi người đã kết hôn ở mọi nhóm tuổi; nhưng **100% người độc thân không có quyền chọn cổ phiếu**. Chỉ xét người không có cổ phiếu, chênh lệch thu hẹp còn 25,5% so với 20,3% — biến gây nhiễu hợp lý nhất là chính sách cổ phiếu."));
C.push(P("**Kiểm định giả thuyết (Tuần 9).** Mức ý nghĩa α = 0,05 đặt trước; mỗi giả thuyết báo cáo đủ độ lớn hiệu ứng, khoảng tin cậy 95% và p-value."));
const tr = M.tests.rows.map((r) => [r[0].replace(/^H\d: /, ""), r[1], r[2].replace(/\./g, ","), r[3], r[4]]);
C.push(table(["Giả thuyết", "Kiểm định", "Độ lớn hiệu ứng và KTC 95%", "p-value", "Kết luận"], tr, [2.8, 1.3, 3.1, 1.2, 1.6]));
C.push(caption("Bảng 5. Kiểm định ba phát hiện chính. KTC = khoảng tin cậy. Cramér's V khoảng 0,2: độ lớn mức vừa; r = 0,20: hiệu ứng nhỏ."));
C.push(P("Hai phát hiện về làm thêm giờ và thâm niên có ý nghĩa thống kê với độ lớn mức vừa. Thu nhập trong cùng cấp 1 cũng có ý nghĩa thống kê nhưng **hiệu ứng nhỏ** (người nghỉ thấp hơn khoảng 10%, so với 38% khi nhìn toàn công ty): có ý nghĩa thống kê không có nghĩa là lớn. **Kiểm tra độ vững:** xoá ngẫu nhiên 10% số dòng 5 lần (random_state 1–5), chênh lệch làm thêm giờ luôn nằm trong 19,4–21,3 điểm %, thâm niên 25,3–28,8; Sales Representative luôn có tỷ lệ nghỉ cao nhất."));

// d
C.push(H2("2.4. Mô hình hoá và đánh giá"));
C.push(P(`**Thiết kế.** Biến mục tiêu Left (1 = nghỉ). Đầu vào: 27 biến gốc (21 biến số, kể cả cờ NCW_flag, và 6 biến phân loại) cộng 6 đặc trưng mới. **Không đưa vào:** Attrition (biến mục tiêu), EmployeeNumber (mã định danh), Gender (thuộc tính nhạy cảm, Mục 2.5), ba cột Rate (không diễn giải được). Chia **80% huấn luyện (1.176 người) / 20% kiểm tra (294 người, 47 người nghỉ)**, phân tầng theo Left để hai tập cùng tỷ lệ 16%, random_state = 42. Thứ tự theo Tuần 10: chia tập trước, rồi mới tiền xử lý.`));
C.push(P(`**Mô hình.** (1) Mô hình mốc: luôn đoán “không nghỉ”; (2) hồi quy logistic (C = 0,3); (3) Random Forest (400 cây, mỗi lá tối thiểu 5 mẫu). Chọn mô hình và ngưỡng bằng **kiểm định chéo 5 phần trên tập huấn luyện**; tập kiểm tra chỉ dùng một lần ở cuối.`));
C.push(P(`**Độ đo chính: recall của nhóm “nghỉ”** — tỷ lệ người thật sự nghỉ mà mô hình phát hiện được. Lý do nghiệp vụ: bỏ sót một người sắp nghỉ (mất người, chi phí tuyển và đào tạo lại) tốn hơn nhiều so với mời nhầm một người vào buổi trao đổi. Độ đo phụ: precision (trong số người bị cảnh báo, bao nhiêu người nghỉ thật), F1 và PR-AUC. **Accuracy không dùng làm độ đo chính**: mô hình mốc đạt ${pct(BASE[6], 1)} mà không phát hiện được ai.`));
C.push(P(`**Xử lý mất cân bằng:** hạ ngưỡng quyết định thay vì đặt trọng số lớp, để xác suất mô hình trả ra vẫn đúng thang thật (trung bình 16,0% so với tỷ lệ nghỉ thật 16,2%) — cần thiết để đọc kết quả là “khả năng nghỉ” ở phần sản phẩm. Quy tắc chọn ngưỡng đặt trước: **ngưỡng cao nhất mà recall vẫn ≥ 70%**, tức phát hiện ít nhất 7/10 người sắp nghỉ và trong giới hạn đó cảnh báo nhầm càng ít càng tốt.`));
const cvr = M.cv.index.map((k, i) => { const r = M.cv.rows[i]; return [k, dec(r[0], 2), dec(r[1], 3), dec(r[2], 3), dec(r[3], 3), dec(r[4], 3), dec(r[5], 3), dec(r[6], 3)]; });
C.push(table(["Mô hình", "Ngưỡng", "Recall", "Precision", "F1", "PR-AUC", "ROC-AUC", "Accuracy"], cvr, [3.0, 0.9, 0.9, 1.0, 0.8, 0.9, 0.9, 1.0],
  { size: 22, align: [null, ...Array(7).fill(AlignmentType.CENTER)], highlight: (r) => r[0] === "Hồi quy logistic" }));
C.push(caption("Bảng 6. So sánh mô hình bằng kiểm định chéo 5 phần trên tập huấn luyện; recall, precision, F1, accuracy tính tại ngưỡng riêng của từng mô hình theo cùng quy tắc."));
C.push(P(`**Chọn hồi quy logistic:** PR-AUC cao nhất (${dec(LR[4], 3)} so với ${dec(RF[4], 3)} của Random Forest và ${dec(BASE[4], 3)} của mô hình mốc); ở cùng mức recall ≥ 70%, precision cao hơn rõ (${dec(LR[2], 2)} so với ${dec(RF[2], 2)}), tức ít cảnh báo nhầm hơn. Hồi quy logistic còn **giải thích được** từng hệ số — quan trọng khi kết quả dùng để quyết định về con người. Ngưỡng được chọn: **${THR}**.`));
C.push(img("fig6_model_eval.png", 16.0, 0.44));
C.push(caption(`Hình 8. Kết quả trên tập kiểm tra (294 người giữ riêng): (a) ma trận nhầm lẫn tại ngưỡng ${THR}; (b) đường precision – recall. Nguồn: IBM HR Attrition.`));
C.push(P(`**Kết quả trên tập kiểm tra:** recall ${pct(TS.Recall, 1)} (phát hiện ${CM[1][1]}/${CM[1][0] + CM[1][1]} người nghỉ, bỏ sót ${CM[1][0]}), precision ${pct(TS.Precision, 1)} (${CM[0][1]} cảnh báo nhầm), F1 ${dec(TS.F1, 3)}, PR-AUC ${dec(TS["PR-AUC"], 3)}, ROC-AUC ${dec(TS["ROC-AUC"], 3)}. Recall thấp hơn mức 71% trong kiểm định chéo: tập kiểm tra chỉ có 47 người nghỉ, mỗi người tương đương 2,1 điểm %, nên chênh vài người là đủ tạo khoảng cách này. Mỗi cảnh báo trúng gấp ${dec(TS.Precision / 0.16, 1)} lần chọn ngẫu nhiên (precision ${pct(TS.Precision, 0)} so với tỷ lệ nghỉ 16%).`));
C.push(img("fig7_coefficients.png", 12.5, 0.559));
C.push(caption("Hình 9. 12 hệ số lớn nhất của hồi quy logistic (biến số đã chuẩn hoá). Dương: gắn với khả năng nghỉ cao hơn; âm: thấp hơn. Mối liên hệ trong mô hình, không phải nhân quả."));
const od = M.odds;
C.push(P(`**Mô hình dựa vào yếu tố nào (Hình 9).** Giữ các yếu tố khác cố định, làm thêm giờ gắn với odds nghỉ cao gấp ${dec(od["OverTime_Yes"], 2)} lần; đi công tác thường xuyên gấp ${dec(od["BusinessTravel_Travel_Frequently"], 2)} lần; mỗi độ lệch chuẩn số năm chưa được thăng chức gấp ${dec(od["YearsSinceLastPromotion"], 2)} lần; độc thân gấp ${dec(od["MaritalStatus_Single"], 2)} lần. Các yếu tố này khớp với phát hiện EDA, cho thấy mô hình học được tín hiệu có nghĩa chứ không phải nhiễu.`));
const abl = M.ablation.index.map((k, i) => [k, dec(M.ablation.rows[i][0], 4)]);
C.push(P(`**Đóng góp của đặc trưng mới.** Thêm 6 đặc trưng mới tăng PR-AUC từ ${dec(M.base_prauc, 3)} lên ${dec(LR[4], 3)} (+${dec(LR[4] - M.base_prauc, 3)}). Bỏ riêng từng đặc trưng, chỉ “thu nhập so với trung vị cùng cấp” làm giảm PR-AUC (${abl[0][1]}); các đặc trưng còn lại có đóng góp gần 0. Mọi mức thay đổi đều nhỏ hơn độ dao động giữa 5 phần kiểm định chéo (độ lệch chuẩn ${dec(M.nostd, 3)}), nên **kết luận trung thực là đặc trưng mới chỉ giúp rất ít** — hồi quy logistic đã có sẵn các biến gốc tạo nên chúng.`));
const leak = M.leak.rows.map((r) => [r[0], r[1]]);
C.push(table(["Điểm rủi ro rò rỉ dữ liệu", "Đã xử lý thế nào"], leak, [2.2, 6.8]));
C.push(caption("Bảng 7. Rà soát rò rỉ dữ liệu (thông tin của tập kiểm tra, hoặc thông tin chỉ có sau khi nghỉ, lọt vào lúc huấn luyện)."));

// e
C.push(H2("2.5. Đạo đức dữ liệu"));
C.push(B("**Bảo mật và ẩn danh:** dữ liệu giả lập, không có tên, số định danh hay thông tin liên hệ; mã nhân viên không đưa vào mô hình. Dữ liệu là bộ công khai trên Kaggle, được dùng cho mục đích học tập."));
const gc = Object.fromEntries(M.gender.index.map((k, i) => [k, M.gender.rows[i]]));
C.push(B(`**Thuộc tính nhạy cảm:** so sánh mô hình có và không có giới tính — PR-AUC ${dec(gc["PR-AUC"][0], 3)} so với ${dec(gc["PR-AUC"][1], 3)}, recall như nhau — nên **mô hình cuối không dùng giới tính**, tránh cảnh báo dựa trên giới tính. Tuổi và tình trạng hôn nhân vẫn dùng vì gắn với giai đoạn sự nghiệp; khi áp dụng thật cần cân nhắc bỏ.`));
const grp = M.grp.index.map((k, i) => { const r = M.grp.rows[i]; const kk = k.replace(/[()']/g, "").split(", "); return [kk[0], kk[1], String(r[0]), String(r[1]), r[2] == null ? "—" : pct(r[2], 0), r[3] == null ? "—" : pct(r[3], 0), pct(r[4], 0)]; });
C.push(table(["Nhóm", "Giá trị", "n", "Số người nghỉ", "Recall", "Precision", "Tỷ lệ bị cảnh báo"], grp, [1.4, 2.6, 0.7, 1.2, 0.9, 1.0, 1.4],
  { size: 22, align: [null, null, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER], highlight: (r) => r[1] === "40–60" }));
C.push(caption("Bảng 8. Kết quả mô hình theo nhóm trên tập kiểm tra (ngưỡng " + THR + ")."));
C.push(B("**Đánh giá thiên kiến:** mô hình **phát hiện kém ở nhóm 40–60 tuổi** (recall 38%, so với 76–79% ở hai nhóm trẻ) và ở phòng Nghiên cứu – Phát triển (52%, so với 88% ở phòng Kinh doanh). Người lớn tuổi nghỉ việc vì lý do khác (có thể có cả nghỉ hưu) mà dữ liệu không ghi lại. Nếu dùng mô hình, nhóm này sẽ ít được chú ý hỗ trợ hơn — cần nêu rõ khi bàn giao. Các nhóm nhỏ (phòng Nhân sự: 15 người, 2 người nghỉ) không đủ để kết luận."));
C.push(B("**Nhóm có thể bị đại diện thiếu:** phòng Nhân sự (63 người), cấp 5 (69 người), nhân viên ly hôn dưới 30 tuổi — kết luận cho các nhóm này kém chắc chắn."));
C.push(B("**Cách dùng phù hợp:** gợi ý ai nên được trao đổi, hỗ trợ trước. **Không dùng** để sa thải, từ chối thăng chức, xếp lương hay đánh giá cá nhân, và không áp dụng cho công ty khác khi chưa kiểm tra lại trên dữ liệu của công ty đó."));

// ===== 3. KẾT QUẢ
C.push(H1("3. Kết quả thực hiện"));
C.push(H2("3.1. Sản phẩm: danh sách nguy cơ, bản đồ nguy cơ và kịch bản mô phỏng"));
C.push(P("Sản phẩm theo hướng **báo cáo phân tích tri thức (Data Insights)**: ba kết quả đầu ra hiển thị trong notebook (mục 16), phòng Nhân sự dùng được ngay. Mọi xác suất là **dự đoán ngoài mẫu** — mỗi người được chấm bởi một mô hình chưa từng thấy người đó khi huấn luyện (kiểm định chéo 5 phần trên toàn bộ dữ liệu)."));
C.push(P(`**Tính năng 1 — Danh sách nhân viên nguy cơ cao.** Chấm xác suất nghỉ cho mọi nhân viên đang làm việc, xếp từ cao xuống thấp, kèm các yếu tố nổi bật của từng người. ${M.n_high} người vượt ngưỡng ${THR}. Bảng 9 là 10 người đứng đầu:`));
const wt = M.watch.rows.slice(0, 10).map((r, i) => [M.watch.index[i], r[0].replace("Research & Development", "R&D"), r[1], String(r[2]), String(r[3]), String(r[4]), pct(r[5], 0), r[6]]);
C.push(table(["Mã NV", "Phòng ban", "Chức danh", "Cấp", "Tuổi", "Thâm niên", "Xác suất nghỉ", "Yếu tố nổi bật"], wt, [0.9, 0.9, 1.9, 0.6, 0.7, 0.9, 0.9, 2.8],
  { size: 20, align: [AlignmentType.CENTER, null, null, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, null] }));
C.push(caption("Bảng 9. 10 nhân viên đang làm việc có xác suất nghỉ dự đoán cao nhất. Mã NV là mã trong bộ dữ liệu giả lập."));
C.push(img("fig8_risk_heatmap.png", 12.5, 0.508));
C.push(caption("Hình 10. Tính năng 2 — xác suất nghỉ dự đoán trung bình theo phòng ban × cấp bậc (chỉ nhân viên đang làm việc). Ô có n nhỏ kém ổn định."));
C.push(P("**Tính năng 2 — Bản đồ nguy cơ theo nhóm** (Hình 10): nguy cơ cao nhất ở nhân viên cấp 1 phòng Kinh doanh (25%), gần gấp đôi cấp 1 các phòng khác (14%) — nơi nên ưu tiên chương trình giữ chân."));
const sc = M.scen.index.map((k, i) => [k, dec(M.scen.rows[i][0], 0), pct(M.scen.rows[i][1], 1), (M.scen.rows[i][2] > 0 ? "+" : "") + dec(M.scen.rows[i][2], 0)]);
C.push(table(["Kịch bản", "Số người nghỉ ước tính", "Tỷ lệ nghỉ ước tính", "Chênh so với hiện tại (người)"], sc, [3.6, 1.8, 1.6, 2.0],
  { align: [null, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }));
C.push(caption("Bảng 10. Tính năng 3 — kịch bản mô phỏng: thay đổi một yếu tố, giữ nguyên các yếu tố khác, mô hình ước tính lại tổng số người nghỉ trên 1.470 nhân viên."));
C.push(P(`**Tính năng 3 — Kịch bản mô phỏng** (Bảng 10). Ở trạng thái hiện tại, mô hình ước tính ${dec(SC["Hiện tại"][0], 0)} người nghỉ (thực tế 237 — mô hình hiệu chỉnh tốt). Nếu nhân viên cấp 1 không làm thêm giờ, mô hình ước tính giảm khoảng ${dec(-SC["Cấp 1 không làm thêm giờ"][2], 0)} người; nếu toàn công ty không làm thêm giờ, giảm khoảng ${dec(-SC["Toàn công ty không làm thêm giờ"][2], 0)} người; cấp cổ phiếu cho người độc thân chỉ giảm khoảng ${dec(-SC["Người độc thân được cấp cổ phiếu mức 1"][2], 0)} người. **Kịch bản minh hoạ:** phòng Nhân sự dùng con số này để ưu tiên thử chính sách giới hạn làm thêm giờ cho cấp 1 trước — tác động ước tính lớn, phạm vi hẹp (một nhóm), dễ đo.`));
C.push(box("Lưu ý khi đọc kịch bản: ", "đây là con số **mô hình ước tính**. Mô hình chỉ học mối liên hệ, nên kết quả không chứng minh chính sách sẽ giảm đúng số người đó — ví dụ người làm thêm giờ có thể đang ở bộ phận thiếu người, và bỏ làm thêm giờ không giải quyết được nguyên nhân gốc. Muốn biết thật cần thử nghiệm A/B (Mục 3.3)."));

C.push(H2("3.2. Những hạn chế"));
const lim = [
  ["Dữ liệu giả lập do IBM tạo, không phải hồ sơ của công ty thật", "Mọi kết quả", "Tỷ lệ và độ lớn chênh lệch có thể không phản ánh doanh nghiệp nào; chỉ dùng như giả thuyết cần kiểm chứng."],
  ["Ảnh chụp một thời điểm, không có ngày nghỉ, không rõ cửa sổ quan sát", "Thâm niên; mô hình", "Người mới vào có ít thời gian để được quan sát nghỉ; chênh lệch 4,3 lần có thể bị phóng đại hoặc thu nhỏ."],
  ["OverTime chỉ là Có/Không, không có số giờ làm thêm", "Làm thêm giờ; kịch bản mô phỏng", "Không xác định được ngưỡng giờ cần can thiệp; kịch bản “không làm thêm giờ” là giả định cực đoan."],
  ["Các biến đo cùng lúc với trạng thái nghỉ (mức hài lòng, cổ phiếu)", "Hài lòng, độc thân; mô hình", "Chiều ảnh hưởng có thể ngược (sắp nghỉ → chấm hài lòng thấp), làm mối liên hệ bị phóng đại."],
  ["Tập kiểm tra chỉ 47 người nghỉ", "Kết quả mô hình", "Mỗi người ≈ 2,1 điểm recall; recall kiểm tra (64%) thấp hơn kiểm định chéo (71%) trong phạm vi dao động này."],
  ["Mô hình phát hiện kém ở nhóm 40–60 tuổi (recall 38%)", "Sử dụng mô hình", "Nhóm này dễ bị bỏ sót nếu chỉ dựa vào danh sách; cần kênh khác (trao đổi trực tiếp)."],
  ["Trùng lặp hoàn toàn: độc thân – không có cổ phiếu; Sales Representative – cấp 1", "Hôn nhân, chức danh", "Không tách được ảnh hưởng; có thể toàn bộ chênh lệch thuộc về biến còn lại."],
  ["Không có lý do nghỉ (tự nguyện, bị cho thôi việc, nghỉ hưu)", "Mọi kết quả", "Nghỉ hưu ở nhóm lớn tuổi gộp chung với nghỉ tự nguyện làm mờ tín hiệu cần giữ chân."],
];
C.push(table(["Hạn chế cụ thể", "Kết luận bị ảnh hưởng", "Mức độ có thể làm lệch kết quả"], lim, [3.3, 1.7, 4.0]));
C.push(caption("Bảng 11. Hạn chế của dự án, gắn với từng kết luận."));

C.push(H2("3.3. Hướng phát triển"));
C.push(B("**Thu thập thêm dữ liệu:** số giờ làm thêm thực tế; ngày vào làm và ngày nghỉ (để phân tích thời gian đến khi nghỉ — phân tích sống còn); lý do nghỉ từ phỏng vấn thôi việc; lịch sử lương, thăng chức; tiêu chí cấp cổ phiếu."));
C.push(B("**Thử nghiệm A/B (Tuần 9)** cho chính sách giới hạn làm thêm giờ: đơn vị thử nghiệm là nhóm làm việc (không phải từng người, để tránh ảnh hưởng chéo trong cùng nhóm); chỉ số chính là tỷ lệ nghỉ sau 12 tháng; chỉ số bảo vệ là năng suất và mức hài lòng; chia ngẫu nhiên các nhóm cấp 1 vào nhóm áp dụng và nhóm đối chứng. Đây là cách duy nhất để chuyển từ “đi kèm” sang “gây ra”."));
C.push(B("**Cải thiện mô hình:** hiệu chỉnh riêng cho nhóm 40–60 tuổi hoặc tách nghỉ hưu khỏi nghỉ tự nguyện; thử mô hình tăng cường độ dốc (gradient boosting); giải thích từng dự đoán (SHAP) để phòng Nhân sự hiểu vì sao một người bị cảnh báo."));
C.push(B("**Sản phẩm:** đưa ba tính năng vào một bảng điều khiển (dashboard) chạy định kỳ trên dữ liệu thật của doanh nghiệp, có người chịu trách nhiệm rà soát danh sách trước khi dùng."));

// ===== Khai báo AI + Tài liệu
C.push(H1("Khai báo sử dụng công cụ AI"));
C.push(P("Dự án có sử dụng **Claude (Anthropic)** làm công cụ hỗ trợ: giải thích khái niệm và bài giảng; viết khung code cho notebook (làm sạch, biểu đồ, mô hình) và gỡ lỗi; soạn bản nháp. Sinh viên: chọn đề tài và câu hỏi nghiên cứu; quyết định các lựa chọn phân tích (giữ ngoại lai, chọn độ đo chính, quy tắc chọn ngưỡng, loại giới tính khỏi mô hình); chạy lại toàn bộ notebook trên máy của mình và kiểm tra mọi con số trong báo cáo khớp với kết quả chạy. Mọi số liệu trong báo cáo được sinh từ notebook, không lấy từ công cụ AI."));

C.push(H1("Tài liệu tham khảo"));
const refs = [
  "IBM. *IBM HR Analytics Employee Attrition & Performance* (dữ liệu giả lập). Kaggle: https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset; OpenML, dataset ID 43696.",
  "Bài giảng học phần INFO3020 — Nhập môn Khoa học dữ liệu, Trường Đại học CMC, Tuần 1–12 (đặc biệt: Tuần 3 chất lượng dữ liệu, Tuần 4 ngoại lai, Tuần 5 biến đổi dữ liệu, Tuần 6–7 thống kê mô tả và trực quan hoá, Tuần 9 kiểm định, Tuần 11 phân loại, Tuần 12 đạo đức dữ liệu).",
  "Pedregosa, F. và cộng sự (2011). Scikit-learn: Machine Learning in Python. *Journal of Machine Learning Research*, 12, 2825–2830.",
  "McKinney, W. (2010). Data Structures for Statistical Computing in Python. *Proceedings of the 9th Python in Science Conference*, 56–61.",
  "Virtanen, P. và cộng sự (2020). SciPy 1.0: Fundamental Algorithms for Scientific Computing in Python. *Nature Methods*, 17, 261–272.",
  "Hunter, J. D. (2007). Matplotlib: A 2D Graphics Environment. *Computing in Science & Engineering*, 9(3), 90–95.",
  "Waskom, M. L. (2021). seaborn: statistical data visualization. *Journal of Open Source Software*, 6(60), 3021.",
];
refs.forEach((r) => C.push(N(r)));
C.push(H2("Phụ lục — Tái lập kết quả"));
C.push(P("Đặt notebooks/eda_attrition.ipynb cùng thư mục với EmployeeAttrition.csv. Cài thư viện: pip install -r requirements.txt. Mở notebook, chọn Kernel → Restart Kernel and Run All Cells (khoảng 1–2 phút). Mọi bảng và 11 hình hiển thị ngay trong notebook. Các phép ngẫu nhiên đều cố định random_state (42 cho chia tập và kiểm định chéo; 1–5 cho kiểm tra độ vững) nên chạy lại ra đúng số liệu trong báo cáo.", { noIndent: true }));

// ---------- mục lục (số trang lấy từ toc_pages.json do cmc_cover.py đo trên bản PDF) ----------
const tocParas = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 160, line: 360 }, children: [new TextRun({ text: "MỤC LỤC", bold: true })] })];
TOC.forEach(([lv, t]) => tocParas.push(new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W, leader: LeaderType.DOT }],
  indent: { left: lv === 1 ? 0 : 284 }, spacing: { before: 0, after: 0, line: 360 },
  children: [new TextRun({ text: t, bold: true }), new TextRun({ text: "\t" + (TOC_PAGES[t] ?? "") })] })));
C.splice(TOC_AT, 0, ...tocParas);

// ---------- tài liệu ----------
const doc = new Document({
  creator: "Phan Hoàng Bách", title: "Báo cáo bài tập lớn — IBM HR Attrition",
  styles: {
    default: { document: { run: { font: FONT, size: 28 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: "000000" }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 160, line: 360 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: "000000" }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { before: 200, after: 120, line: 360 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "●", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "[%1]", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 500 } } } }] },
  ] },
  sections: [{
    properties: { titlePage: true, page: { size: { width: PAGE_W, height: 16838 }, pageNumbers: { start: 0 },
      margin: { top: 1134, bottom: 1134, left: MARGIN_L, right: MARGIN_R, header: 0, footer: 431 } } },
    footers: {
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }),
    },
    children: C,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  const out = path.join(ROOT, "report", "BaoCao_BaiTapLon_PhanHoangBach.docx");
  fs.writeFileSync(out, buf); console.log("Đã ghi", out);
});
