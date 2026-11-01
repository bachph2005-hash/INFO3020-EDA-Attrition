// Tạo báo cáo EDA giữa kỳ (.docx) — chạy: node report/build_report.js  (từ thư mục gốc dự án)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, AlignmentType,
  HeadingLevel, WidthType, ShadingType, BorderStyle, LevelFormat, Footer, PageNumber, PageBreak,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const T = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, "tables.json"), "utf8"));
const FIG = (f) => fs.readFileSync(path.join(ROOT, "outputs", "figures", f));

const FONT = "Times New Roman";
const PAGE_W = 11906, MARGIN_L = 1418, MARGIN_R = 1134; // A4, lề trái 2,5cm, phải 2cm
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 9354 DXA ≈ 16,5cm
const HEAD_FILL = "DCEBF7";
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
  spacing: { before: 30, after: 60, line: 266 }, indent: opts.noIndent ? undefined : { firstLine: 0 }, ...(opts.para || {}) });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const B = (text, level = 0) => new Paragraph({ numbering: { reference: "bul", level }, children: runs(text),
  alignment: AlignmentType.JUSTIFIED, spacing: { before: 20, after: 40, line: 262 } });
const N = (text) => new Paragraph({ numbering: { reference: "num", level: 0 }, children: runs(text),
  alignment: AlignmentType.JUSTIFIED, spacing: { before: 30, after: 60, line: 262 } });
const caption = (t) => new Paragraph({ children: runs(t, { size: 18, italics: true, color: "444444" }),
  alignment: AlignmentType.LEFT, spacing: { before: 20, after: 140 } });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function img(file, widthCm, ratio) {
  const w = Math.round(widthCm * 37.8); // px ở 96dpi
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 20 },
    children: [new ImageRun({ type: "png", data: FIG(file), transformation: { width: w, height: Math.round(w * ratio) },
      altText: { title: file, description: file, name: file } })] });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "9CA3AF" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(header, rows, widths, opts = {}) {
  const fs_ = opts.size || 18; // 9pt
  const sum = widths.reduce((a, b) => a + b, 0);
  const W = widths.map((w) => Math.round((w / sum) * CONTENT_W));
  W[W.length - 1] += CONTENT_W - W.reduce((a, b) => a + b, 0);
  const cell = (txt, i, head, rowOpts = {}) => new TableCell({
    borders, width: { size: W[i], type: WidthType.DXA },
    shading: head ? { fill: HEAD_FILL, type: ShadingType.CLEAR, color: "auto" } : rowOpts.fill ? { fill: rowOpts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 20, bottom: 20, left: 70, right: 70 },
    children: [new Paragraph({ alignment: head ? AlignmentType.CENTER : (opts.align && opts.align[i]) || AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: 240 }, children: [new TextRun({ text: String(txt), size: fs_, bold: head || undefined })] })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: W,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, { fill: opts.highlight && opts.highlight(r, ri) ? "FDEBDD" : undefined })) }))],
  });
}
const vn = (x, d = 2) => { const n = Number(x); if (Number.isNaN(n)) return x; return n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }); };
const spacer = () => new Paragraph({ spacing: { before: 0, after: 60 }, children: [] });

// ---------- nội dung ----------
const C = [];

// Khối tiêu đề
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "TRƯỜNG ĐẠI HỌC CMC — KHOA CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG", size: 22 })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "INFO3020 · Nhập môn Khoa học dữ liệu · Bài giữa kỳ (20%)", size: 22, italics: true })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "BÁO CÁO PHÂN TÍCH KHÁM PHÁ DỮ LIỆU (EDA)", bold: true, size: 32 })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "Ai nghỉ việc, và điều gì đi kèm với việc nghỉ? — Bộ dữ liệu IBM HR Employee Attrition", bold: true, size: 26, color: ACCENT })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Sinh viên thực hiện: Phan Hoàng Bách", size: 24 })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 } },
  children: [new TextRun({ text: "Sản phẩm nộp kèm: notebooks/eda_attrition.ipynb (chạy trọn vẹn bằng Restart & Run All) · đường dẫn repository: [điền link]", size: 20, italics: true })] }));

// 1. Bối cảnh
C.push(H1("1. Bối cảnh và câu hỏi nghiên cứu"));
C.push(P("**Tình huống (Situation).** Một doanh nghiệp có 1.470 nhân viên, trong đó 237 người (16,1%) đã nghỉ việc. Mỗi người nghỉ kéo theo chi phí tuyển dụng, đào tạo người thay thế và thời gian để người mới đạt năng suất."));
C.push(P("**Vấn đề (Complication).** Phòng Nhân sự có ngân sách giới hạn cho các chương trình giữ chân nhân viên (điều chỉnh làm thêm giờ, kèm cặp nhân viên mới, điều chỉnh lương, chính sách cổ phiếu). Nếu dàn trải cho toàn bộ 1.470 người, chương trình sẽ mỏng và khó đo hiệu quả."));
C.push(P("**Người dùng và quyết định.** Người dùng chính là **Trưởng phòng Nhân sự** và Ban Giám đốc. Phân tích phục vụ một quyết định cụ thể: *nên ưu tiên nhóm nhân viên nào và đòn bẩy nào cho đợt chương trình giữ chân tiếp theo, và cần thu thập thêm dữ liệu gì trước khi đầu tư lớn.*"));
C.push(new Paragraph({ spacing: { before: 120, after: 120 }, indent: { left: 400, right: 400 }, shading: { type: ShadingType.CLEAR, fill: "FDEBDD", color: "auto" },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT, space: 8 } },
  children: [new TextRun({ text: "Câu hỏi nghiên cứu (Question): ", bold: true }), new TextRun({ text: "Nhóm nhân viên nào có tỷ lệ nghỉ việc cao nhất, và yếu tố nào vẫn gắn với nghỉ việc khi so sánh trong cùng cấp bậc công việc?", italics: true })] }));
C.push(P("**Phạm vi.** Đây là phân tích *mô tả và chẩn đoán* (Tuần 6–7): báo cáo nêu các **mối liên hệ (association)**, không khẳng định quan hệ nhân quả. Câu “cấp bậc” được đưa vào câu hỏi vì thu nhập, tuổi, thâm niên đều gắn chặt với cấp bậc (Spearman ρ từ 0,47 đến 0,92) — một chênh lệch chỉ có ý nghĩa nếu nó còn tồn tại khi đã so người cùng cấp."));
C.push(P("**Câu trả lời ngắn (Answer).** Làm thêm giờ và giai đoạn 0–1 năm đầu là hai tín hiệu mạnh và ổn định nhất; chênh lệch về thu nhập phần lớn chỉ là “cái bóng” của cấp bậc; chức danh Sales Representative và nhóm độc thân có tỷ lệ cao nhưng trùng với các yếu tố khác nên chưa thể kết luận về chúng (Mục 5)."));

// 2. Nguồn và từ điển dữ liệu
C.push(H1("2. Nguồn dữ liệu và từ điển dữ liệu"));
C.push(P("**Nguồn.** Bộ dữ liệu *IBM HR Analytics Employee Attrition & Performance*, công bố trên Kaggle (pavansubhasht/ibm-hr-analytics-attrition-dataset) và OpenML (ID 43696). Theo mô tả gốc, đây là **dữ liệu giả lập do các nhà khoa học dữ liệu của IBM tạo ra**, không phải hồ sơ nhân sự của một công ty thật. File nhận được: EmployeeAttrition.csv, 1.470 dòng × 35 cột, mã hoá UTF-8 có BOM, dấu phân cách là dấu phẩy, không có cột ngày tháng."));
C.push(P("**Thời điểm thu thập.** Nguồn **không công bố** thời điểm hay khoảng thời gian quan sát; dữ liệu là một ảnh chụp tại một thời điểm (cross-section). Vì vậy không thể biết “Attrition = Yes” được tính trong khoảng thời gian bao lâu — điểm này được nêu lại ở Mục 6."));
C.push(P("**Đánh giá chất lượng theo 6 chiều (Tuần 3), thang 1–5:** Completeness 5 (0 ô trống, 0 giá trị thiếu trá hình); Uniqueness 5 (0 dòng trùng, mã nhân viên duy nhất); Validity 5 (0 giá trị ngoài miền trên 9 cột thang đo); Consistency 4 (5 ràng buộc logic đều đạt, nhưng 197 dòng NumCompaniesWorked = 0 mâu thuẫn); Accuracy 3 (ba cột DailyRate/HourlyRate/MonthlyRate không khớp thu nhập, MonthlyIncome không ghi đơn vị tiền); Timeliness 2 (không rõ thời điểm thu thập)."));
C.push(P("**Từ điển dữ liệu** (mẫu Tuần 2). Cột “Nguồn” giống nhau cho mọi dòng (IBM HR Analytics, Kaggle/OpenML) nên được ghi một lần ở trên. Không cột nào có giá trị thiếu.", { noIndent: true }));
const dd = T.data_dictionary.rows.map((r) => [r[0], r[1], r[2], r[3], r[5]]);
C.push(table(["Cột", "Kiểu", "Đơn vị", "Mô tả", "Số giá trị khác nhau"], dd, [2.4, 1.0, 1.4, 5.0, 0.8], { size: 15, align: [null, null, null, null, AlignmentType.CENTER] }));
C.push(caption("Bảng 1. Từ điển dữ liệu — 35 cột gốc. Bảng mã thang đo (1 = Thấp … 4 = Rất cao; Education 1 = Dưới cao đẳng … 5 = Tiến sĩ) lấy theo mô tả gốc của bộ dữ liệu."));

// 3. Cleaning log
C.push(H1("3. Nhật ký làm sạch dữ liệu"));
C.push(P("Mỗi bước dưới đây được thực hiện bằng code trong notebook (mục 2–3) và ghi ngay vào bảng nhật ký hiển thị trong notebook khi chạy. File dữ liệu gốc không bị sửa; bảng dữ liệu sau làm sạch có 1.470 dòng, 43 cột. **Không dòng nào bị xoá.** Các quyết định *không can thiệp* (B2, B3, B8, B11, B12) cũng được ghi, kèm cách đã xác minh; riêng ngoại lai được phân tích đầy đủ ở mục 3.2."));
const SHORT = { "11": ["MonthlyIncome", "IQR: 114 dòng > 16.581; Z cải tiến: 118; Z-score: 0", "Giữ; dùng trung vị, Spearman, so trong cùng cấp", "Cả 114 là cấp 4–5, không ai vượt khung lương của cấp; bỏ đi không đổi kết luận (mục 3.2)"],
  "12": ["10 cột số còn lại", "IQR đánh dấu ở 7 cột (14–238 điểm/cột); Age, DistanceFromHome, PercentSalaryHike: 0", "Giữ toàn bộ", "Không có giá trị không thể có; cột số năm là người gắn bó lâu; TrainingTimesLastYear bị đánh dấu do Q1–Q3 quá hẹp (mục 3.2)"] };
const log = T.cleaning_log.rows.map((r) => SHORT[r[0]] ? ["B" + r[0], SHORT[r[0]][0], SHORT[r[0]][1], SHORT[r[0]][2], r[4], SHORT[r[0]][3]] : ["B" + r[0], r[1], r[2], r[3], r[4], r[5]]);
C.push(table(["Bước", "Cột", "Phát hiện", "Hành động", "Số dòng", "Lý do / cách xác minh"], log, [0.6, 1.7, 2.5, 2.0, 0.7, 3.2],
  { size: 15, align: [AlignmentType.CENTER, null, null, null, AlignmentType.CENTER, null], highlight: (r) => ["B9", "B10", "B11"].includes(r[0]) }));
C.push(caption("Bảng 2. Nhật ký làm sạch. Tô màu: ba quyết định cần lập luận nhiều nhất (giải thích bên dưới). “Số dòng” là số dòng bị tác động hoặc được đánh dấu."));
C.push(H2("3.1. Lập luận cho các quyết định quan trọng"));
C.push(B("**Giá trị thiếu và cơ chế thiếu (B2).** Không có ô trống và không có giá trị thiếu trá hình (đã quét các chuỗi “N/A”, “-”, “?”, “unknown” và mã âm kiểu −999). Vì không có dữ liệu thiếu nên **không xếp được cơ chế MCAR/MAR/MNAR** và không cần điền giá trị. Số 0 ở YearsAtCompany (44 người) và TrainingTimesLastYear được xem là hợp lệ vì khớp với nhân viên mới vào (YearsInCurrentRole cũng bằng 0). Điều đáng lưu ý: “đầy đủ” ở đây là dấu hiệu dữ liệu đã được làm sạch hoặc tạo ra sẵn — chính là điểm yếu về độ chân thực nêu ở Mục 6."));
C.push(B("**NumCompaniesWorked = 0 (B9).** Cả 197 người ghi “0 công ty trước đây” đều có tổng năm đi làm lớn hơn năm tại công ty **đúng 1 năm**. Một lệch đều như vậy gợi ý lỗi mã hoá có hệ thống (có thể “0” thực ra là “1”), nhưng không có tài liệu để xác minh. Chọn **đánh dấu (cờ NCW_flag) thay vì sửa**: sửa sẽ là đoán, còn xoá 197 dòng (13%) sẽ làm mất dữ liệu đúng ở các cột khác. Cột này không được dùng làm căn cứ cho kết luận nào."));
C.push(B("**Ba cột Rate (B10).** DailyRate, HourlyRate, MonthlyRate có phân phối đều (kurtosis ≈ −1,2, skewness ≈ 0) và gần như không tương quan với MonthlyIncome (|ρ| ≤ 0,05) hay JobLevel. Một “mức lương theo giờ” không tăng theo cấp bậc là vô lý về nghiệp vụ, nên các cột này được giữ trong file sạch (để người khác có thể kiểm lại) nhưng **loại khỏi phân tích**."));
C.push(B("**Ngoại lai (B11, B12).** Không xoá, không sửa dòng nào; bằng chứng cho quyết định này được trình bày riêng ở mục 3.2."));
C.push(B("**Ba cột hằng số (B4).** EmployeeCount (luôn 1), Over18 (luôn “Y”), StandardHours (luôn 80) không phân biệt được ai với ai nên bị loại. Hệ quả: dữ liệu **không có số giờ làm thực tế** — OverTime chỉ là biến Có/Không."));

C.push(H2("3.2. Ngoại lai (outlier): phát hiện, điều tra và quyết định"));
C.push(P("Ngoại lai được xử lý theo trình tự của Tuần 4: **nhìn** (boxplot 11 biến số trong notebook, mục 3.1), **phát hiện** bằng ba phương pháp, **điều tra** từng nhóm bị đánh dấu, **quyết định** có lý do, rồi **kiểm tra ảnh hưởng** đến kết luận. Bảng 3 đặt ba phương pháp cạnh nhau: kết quả của chúng khác nhau rất nhiều, nên việc chọn phương pháp tự nó là một quyết định phải giải thích."));
const OD = { MonthlyIncome: "Giữ — toàn bộ là lương cấp 4–5", TotalWorkingYears: "Giữ — người đi làm lâu", YearsAtCompany: "Giữ — gắn bó lâu, qua kiểm tra logic",
  YearsInCurrentRole: "Giữ", YearsSinceLastPromotion: "Giữ — 95% có thâm niên ≥ 10 năm", YearsWithCurrManager: "Giữ",
  NumCompaniesWorked: "Giữ; không dùng để kết luận (17 người 9 công ty < 9 năm đi làm)", TrainingTimesLastYear: "Giữ — do Q1–Q3 quá hẹp, không phải ngoại lai",
  PercentSalaryHike: "Giữ — 25% là mức trần của thang", Age: "Không có", DistanceFromHome: "Không có" };
const orows = T.outliers.rows.filter((r) => !["Age", "DistanceFromHome"].includes(r[0])).map((r) => [r[0], vn(r[4], 2), String(r[5]), String(r[6]), String(r[7]), String(r[8]), OD[r[0]]]);
C.push(table(["Cột", "Skewness", "Z-score |z| > 3", "Z cải tiến |M| > 3,5", "IQR × 1,5", "IQR × 3", "Quyết định"], orows, [2.4, 0.9, 0.9, 1.0, 0.8, 0.7, 3.6],
  { size: 16, align: [null, AlignmentType.RIGHT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, null], highlight: (r) => r[0] === "MonthlyIncome" }));
C.push(caption("Bảng 3. Số điểm bị đánh dấu là ngoại lai theo ba phương pháp (Z cải tiến dùng trung vị và MAD). Age và DistanceFromHome: 0 điểm ở cả ba phương pháp."));
C.push(B("**Không có giá trị “không thể có”.** Kiểm tuổi trong 18–65, thu nhập > 0, các cột số năm ≥ 0, tổng năm đi làm ≤ tuổi − 14, mức tăng lương trong 0–100%: **0 vi phạm**. Mọi điểm bị đánh dấu đều thuộc loại “hiếm gặp” — cần điều tra, không có căn cứ để xoá."));
C.push(B("**Vì sao ba phương pháp khác nhau.** Với thu nhập, Z-score không đánh dấu ai vì phân phối lệch phải (skewness 1,37) làm độ lệch chuẩn phình to và che lấp chính các điểm cực trị; Z cải tiến và IQR đánh dấu 118 và 114 người. Ngược lại, trên biến rời rạc hẹp, IQR đánh dấu 238 người đào tạo 0, 5 hoặc 6 lần chỉ vì Q1 = 2 và Q3 = 3; Z cải tiến đánh dấu 18 người tăng lương 25% — đúng mức trần của thang 11–25%. Đây là giới hạn của quy tắc, không phải ngoại lai thật."));
C.push(B("**Thu nhập: ngoại lai toàn công ty và ngoại lai theo ngữ cảnh** (Hình 1). Cả 114 người bị đánh dấu đều là cấp 4 (45 người) và cấp 5 (69 người) — lương quản lý thật. Khi áp quy tắc IQR **trong từng cấp**, chỉ còn 38 người cấp 1–2 có thu nhập cao bất thường so với đồng cấp, nhưng vẫn dưới mức tối đa của cấp đó; tỷ lệ nghỉ của họ là 18,4%, gần mức chung 16,1%."));
C.push(img("figB_outlier_income_level.png", 10.0, 0.65));
C.push(caption("Hình 1. Thu nhập tháng theo cấp bậc; chấm cam là 114 người bị quy tắc IQR toàn công ty đánh dấu. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(B("**Các cột số năm.** 104 người có thâm niên trên 18 năm (tuổi trung vị 44), tất cả đều qua kiểm tra logic B8; 107 người trên 7,5 năm chưa được thăng chức, trong đó 95% có thâm niên từ 10 năm — hợp lý với người ở lâu."));
const im = Object.fromEntries(T.outlier_impact.rows.map((r) => [r[0], r]));
C.push(B(`**Kiểm tra ảnh hưởng.** Bỏ toàn bộ ${im["Số dòng"][3] * -1} dòng (16%) bị IQR đánh dấu ở bốn cột thu nhập, tổng năm đi làm, thâm niên và số năm từ lần thăng chức, rồi tính lại: tỷ lệ nghỉ chung tăng từ ${vn(im["Tỷ lệ nghỉ chung (%)"][1], 1)}% lên ${vn(im["Tỷ lệ nghỉ chung (%)"][2], 1)}% (nhóm ngoại lai là cấp cao, thâm niên dài, ít nghỉ hơn); làm thêm giờ ${vn(im["Làm thêm giờ: Có (%)"][1], 1)}% / ${vn(im["Làm thêm giờ: Không (%)"][1], 1)}% thành ${vn(im["Làm thêm giờ: Có (%)"][2], 1)}% / ${vn(im["Làm thêm giờ: Không (%)"][2], 1)}%; thâm niên 0–1 năm ${vn(im["Thâm niên 0–1 năm (%)"][1], 1)}% thành ${vn(im["Thâm niên 0–1 năm (%)"][2], 1)}%; Sales Representative giữ nguyên ${vn(im["Sales Representative (%)"][1], 1)}%. **Không kết luận nào đổi chiều.** Chỉ trung bình thu nhập giảm mạnh (${vn(im["Thu nhập: trung bình"][1], 0)} còn ${vn(im["Thu nhập: trung bình"][2], 0)}) trong khi trung vị giảm ít hơn (${vn(im["Thu nhập: trung vị"][1], 0)} còn ${vn(im["Thu nhập: trung vị"][2], 0)}) — lý do báo cáo dùng trung vị.`));
C.push(B("**Quyết định: giữ toàn bộ, đổi công cụ thay vì đổi dữ liệu.** Chặn trần 1%–99% (winsorize) chỉ chạm 30 dòng và gần như không đổi trung bình; biến đổi log1p giảm skewness thu nhập từ 1,37 xuống 0,29 nhưng làm kết quả khó diễn giải. Vì phân tích đã dùng các công cụ chịu được ngoại lai — trung vị, tương quan Spearman, nhóm hoá (thâm niên 11+ năm, tứ phân vị thu nhập) và so sánh trong cùng cấp — nên không cần sửa giá trị nào."));

// 4. EDA
C.push(H1("4. Phân tích khám phá"));
C.push(H2("4.1. Thống kê mô tả — đủ bốn nhóm"));
C.push(P("Bảng 4 tóm tắt 11 biến số theo ba nhóm đầu: **vị trí** (trung bình, trung vị, p10, p90), **độ phân tán** (độ lệch chuẩn, IQR, hệ số biến thiên CV) và **hình dạng** (skewness, kurtosis). Nhóm thứ tư — **quan hệ** — ở Hình 2."));
const ds = T.descriptive_stats.rows.map((r) => [r[0], vn(r[1], 1), vn(r[2], 0), vn(r[3], 0), vn(r[4], 0), vn(r[5], 1), vn(r[6], 0), vn(r[7], 2), vn(r[8], 2), vn(r[9], 2), r[10]]);
C.push(table(["Biến", "TB", "Trung vị", "p10", "p90", "ĐLC", "IQR", "CV", "Skew", "Kurt", "Nên dùng"], ds, [2.6, 0.9, 0.9, 0.8, 0.8, 0.9, 0.8, 0.7, 0.7, 0.7, 1.1],
  { size: 16, align: [null, ...Array(9).fill(AlignmentType.RIGHT), AlignmentType.CENTER], highlight: (r) => r[0] === "MonthlyIncome" || r[0] === "YearsAtCompany" }));
C.push(caption("Bảng 4. Thống kê mô tả (n = 1.470). TB = trung bình, ĐLC = độ lệch chuẩn. “Nên dùng”: trung vị khi |skewness| > 1 (quy tắc Tuần 6)."));
C.push(B("**Thu nhập lệch phải rõ rệt:** trung bình 6.503 cao hơn trung vị 4.919 tới 32%; p10 = 2.318 còn p90 = 13.776 (gấp 5,9 lần). Vì vậy mọi so sánh thu nhập trong báo cáo dùng **trung vị**."));
C.push(B("**Thâm niên tập trung ở mức thấp, đuôi dài:** trung vị 5 năm, nhưng kurtosis 3,9 cho thấy có một nhóm nhỏ gắn bó rất lâu (tối đa 40 năm). YearsSinceLastPromotion có CV cao nhất (1,47) — đa số mới được thăng chức gần đây, một số ít bị “kẹt” nhiều năm."));
C.push(B("**Biến phân loại (mode):** Attrition = No (83,9%), OverTime = No (71,7%), phòng R&D (65,4%), Married (45,8%), Travel_Rarely (71,0%), Male (60,0%). Lớp “nghỉ việc” chỉ chiếm 16,1% — tỷ lệ chung này là đường tham chiếu trong mọi biểu đồ."));
C.push(img("fig0_correlation.png", 10.0, 0.90));
C.push(caption("Hình 2. Ma trận tương quan Spearman (dùng Spearman vì nhiều biến lệch và thứ bậc). Ba “cụm” rõ: thu nhập–cấp bậc–tổng năm làm (ρ 0,71–0,92); các biến thâm niên (ρ 0,72–0,85); các biến hài lòng gần như độc lập với nhau. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Ý nghĩa cho phân tích:** vì thu nhập, cấp bậc, tuổi và thâm niên đi cùng nhau, bất kỳ chênh lệch nào theo một biến trong cụm này đều có thể là ảnh hưởng của biến khác trong cụm. Đây là lý do mọi phát hiện ở 4.3 đều được kiểm tra lại **trong từng nhóm con**."));

C.push(H2("4.2. Phân tích theo nhóm: chênh lệch tỷ lệ nghỉ việc"));
const gs = T.group_spread.rows.filter((r) => !["Gender", "PerformanceRating_label", "Department"].includes(r[0]) || true)
  .map((r) => [r[0].replace("_label", ""), r[1], (Number(r[2]) * 100).toFixed(1).replace(".", ",") + "%", r[3], (Number(r[4]) * 100).toFixed(1).replace(".", ",") + "%", vn(r[5], 1)]);
C.push(table(["Biến", "Nhóm cao nhất", "Tỷ lệ", "Nhóm thấp nhất", "Tỷ lệ", "Chênh (điểm %)"], gs, [2.6, 2.0, 0.9, 2.0, 0.9, 1.1],
  { size: 15, align: [null, null, AlignmentType.RIGHT, null, AlignmentType.RIGHT, AlignmentType.RIGHT] }));
C.push(caption("Bảng 5. Khoảng chênh tỷ lệ nghỉ việc giữa nhóm cao nhất và thấp nhất của từng biến (chỉ xét nhóm có n ≥ 50). Sắp xếp giảm dần theo độ chênh."));
C.push(P("Bảng 5 cho thấy giới tính (chênh 2,2 điểm %) và đánh giá hiệu suất (0,3 điểm %) gần như **không** liên quan đến nghỉ việc, trong khi chức danh, thâm niên, mức gắn kết, cấp bậc và làm thêm giờ tạo ra chênh lệch 20–37 điểm %. Tuy nhiên, độ chênh lớn chưa nói lên điều gì về nguyên nhân: cấp bậc, chức danh, tuổi và thu nhập trùng nhau. Mục 4.3 trình bày năm biểu đồ chính, mỗi biểu đồ trả lời một câu hỏi và kèm một phép kiểm tra trong nhóm con."));

C.push(H2("4.3. Năm biểu đồ chính"));
C.push(img("fig1_overtime_by_level.png", 13.0, 0.638));
C.push(caption("Hình 3. Tỷ lệ nghỉ việc theo làm thêm giờ trong từng cấp bậc. Nguồn: IBM HR Attrition, n = 1.470, ảnh chụp một thời điểm."));
C.push(P("**Làm thêm giờ.** Tỷ lệ nghỉ của người làm thêm giờ là 30,5% so với 10,4% (gấp 2,9 lần). Có thể nghi ngờ đây là hiệu ứng của cấp bậc — nhưng tỷ lệ làm thêm giờ gần như bằng nhau ở mọi cấp (26–31%), và trong từng cấp người làm thêm giờ vẫn nghỉ nhiều hơn 1,7–4,3 lần. Chênh lệch cũng còn nguyên khi tách theo nhóm tuổi (53% so với 18% ở 18–29 tuổi; 20% so với 7% ở 40–60 tuổi), theo phòng ban và theo tứ phân vị thu nhập (tỷ số 2,5–3,3). Đây là phát hiện **vững nhất** của báo cáo."));
C.push(img("fig2_tenure.png", 12.5, 0.548));
C.push(caption("Hình 4. Tỷ lệ nghỉ việc theo thâm niên tại công ty. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Thâm niên.** 34,9% người có thâm niên 0–1 năm đã nghỉ, giảm dần còn 8,1% ở nhóm trên 10 năm. Khi tách theo tuổi, hiệu ứng **tập trung ở người trẻ**: thâm niên 0–1 năm có tỷ lệ nghỉ 55% ở nhóm 18–29 tuổi, 32% ở 30–39 tuổi nhưng chỉ 14% ở 40–60 tuổi — gần với mức chung của nhóm tuổi đó (11%). Nói cách khác, “mới vào” và “còn trẻ” cộng hưởng với nhau, và dữ liệu không đủ để tách hẳn hai yếu tố."));
C.push(img("fig3_income_vs_level.png", 15.2, 0.56));
C.push(caption("Hình 5. (a) Tỷ lệ nghỉ việc theo tứ phân vị thu nhập; (b) trung vị thu nhập của người nghỉ và người ở lại trong từng cấp bậc. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Thu nhập — ví dụ về biến gây nhiễu.** Nhìn tổng thể, nhóm thu nhập thấp nhất nghỉ 29,3% so với ~10% ở ba nhóm còn lại, và trung vị thu nhập người nghỉ thấp hơn người ở lại 38%. Nhưng 96% nhóm thu nhập thấp nhất là nhân viên cấp 1, và thu nhập tương quan với cấp bậc ρ = 0,92. Khi so **trong cùng cấp**, khoảng cách thu nhập thu hẹp còn −10% (cấp 1), gần 0 (cấp 2, 3, 5); riêng cấp 4 là −19% nhưng chỉ dựa trên 5 người nghỉ. Kết luận đúng là: *thu nhập thấp đi kèm nghỉ việc chủ yếu vì nó đi kèm cấp bậc thấp*; một chính sách “tăng lương chung” có thể không nhắm đúng vấn đề."));
C.push(img("fig4_jobrole.png", 13.0, 0.55));
C.push(caption("Hình 6. Tỷ lệ nghỉ việc theo chức danh, kèm cỡ mẫu từng nhóm. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Chức danh.** Sales Representative có tỷ lệ nghỉ 39,8% (33/83 người), gấp 16 lần Research Director (2,5%). Tuy nhiên đây là nhóm trẻ nhất (tuổi trung vị 30) và 92% ở cấp 1, trong khi tỷ lệ làm thêm giờ của họ (29%) không khác mức chung. Vì vậy biểu đồ này **chỉ ra nơi cần ưu tiên** chứ không chứng minh bản thân công việc bán hàng gây ra nghỉ việc. Cỡ mẫu 83 người cũng nhỏ: thêm hoặc bớt 5 người nghỉ sẽ làm tỷ lệ dao động khoảng ±6 điểm %."));
C.push(img("fig5_marital_age.png", 11.5, 0.635));
C.push(caption("Hình 7. Tỷ lệ nghỉ việc theo tình trạng hôn nhân và nhóm tuổi. Nguồn: IBM HR Attrition, n = 1.470."));
C.push(P("**Tình trạng hôn nhân — biến gây nhiễu hoàn hảo.** Người độc thân nghỉ việc nhiều gần gấp đôi người đã kết hôn ở cả ba nhóm tuổi (41% so với 21%; 21% so với 11%; 17% so với 9%), nên tuổi không giải thích được chênh lệch này. Nhưng **100% trong 470 người độc thân có StockOptionLevel = 0** — không ai có quyền chọn cổ phiếu. Chỉ xét những người không có cổ phiếu, chênh lệch thu hẹp đáng kể: độc thân 25,5% so với đã kết hôn 20,3%. Dữ liệu này không thể cho biết đâu là yếu tố thực sự gắn với nghỉ việc: tình trạng hôn nhân hay chính sách cổ phiếu (vốn có thể được thiết kế dựa trên tình trạng gia đình)."));

C.push(H2("4.4. Kiểm tra độ vững"));
C.push(P("Để trả lời câu hỏi “nếu xoá ngẫu nhiên 10% số dòng, kết luận có thay đổi không”, notebook làm 5 lần, mỗi lần bỏ ngẫu nhiên 10% dữ liệu bằng lệnh sample(frac=0.9, random_state=i) với i = 1…5, rồi tính lại các chênh lệch chính (Bảng 6). Cả 5 lần, mọi chênh lệch đều giữ nguyên chiều và độ lớn gần như không đổi; Sales Representative luôn có tỷ lệ nghỉ cao nhất. Lưu ý đây là phép thử độ nhạy trên **chính mẫu này**, chưa phải kiểm định thống kê (Tuần 9)."));
const rb = [
  ["Chênh làm thêm giờ (Có − Không)", "21,3", "19,4", "19,6", "20,1", "20,0"],
  ["Chênh làm thêm giờ trong cấp 1", "37,6", "36,5", "35,4", "37,7", "36,2"],
  ["Thâm niên 0–1 năm − trên 10 năm", "28,8", "26,2", "25,9", "25,3", "25,8"],
  ["Chức danh nghỉ nhiều nhất", "Sales Rep", "Sales Rep", "Sales Rep", "Sales Rep", "Sales Rep"],
];
C.push(table(["Chỉ số (điểm %)", "Lần 1", "Lần 2", "Lần 3", "Lần 4", "Lần 5"], rb, [4.0, 1.1, 1.1, 1.1, 1.1, 1.1],
  { size: 18, align: [null, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }));
C.push(caption("Bảng 6. Các chênh lệch chính qua 5 lần xoá ngẫu nhiên 10% dữ liệu (random_state = 1 đến 5)."));

// 5. Key findings
C.push(H1("5. Các phát hiện chính"));
C.push(N("**Làm thêm giờ đi kèm tỷ lệ nghỉ việc cao gấp 2,9 lần (30,5% so với 10,4%), và chênh lệch này còn ở mọi cấp bậc, nhóm tuổi, phòng ban, mức thu nhập** (Hình 3). Đây là đòn bẩy có thể tác động được và nên được thử nghiệm đầu tiên — bắt đầu với nhân viên cấp 1 làm thêm giờ, nhóm có tỷ lệ nghỉ 53%."));
C.push(N("**Một phần ba nhân viên có thâm niên 0–1 năm nghỉ việc (34,9%), cao gấp 4,3 lần nhóm trên 10 năm; hiệu ứng mạnh nhất ở người dưới 30 tuổi (55%)** (Hình 4). Chương trình hội nhập và kèm cặp trong năm đầu nên ưu tiên nhân viên trẻ."));
C.push(N("**Thu nhập thấp đi kèm nghỉ việc ở mức tổng thể (29,3% ở nhóm thấp nhất), nhưng phần lớn chênh lệch biến mất khi so trong cùng cấp bậc** (Hình 5). Không nên kết luận “tăng lương sẽ giảm nghỉ việc”; vấn đề nằm ở cấp bậc thấp, có thể liên quan đến lộ trình thăng tiến."));
C.push(N("**Sales Representative nghỉ việc 39,8% — cao nhất trong 9 chức danh** (Hình 6), nhưng trùng với nhóm trẻ, cấp 1; đây là nhóm cần khảo sát sâu (phỏng vấn thôi việc) hơn là cần kết luận ngay."));
C.push(N("**Người độc thân nghỉ việc gần gấp đôi người đã kết hôn ở mọi nhóm tuổi, nhưng không thể tách khỏi việc 100% người độc thân không có quyền chọn cổ phiếu** (Hình 7). Biến gây nhiễu hợp lý nhất cho mối liên hệ này là chính sách cổ phiếu."));
C.push(P("*Mọi phát hiện trên là mối liên hệ quan sát được trong một ảnh chụp dữ liệu giả lập. Chúng xác định nhóm và đòn bẩy cần ưu tiên kiểm chứng, không chứng minh nguyên nhân.*"));

// 6. Limitations
C.push(H1("6. Giới hạn và bước tiếp theo"));
C.push(H2("6.1. Những gì dữ liệu này không trả lời được"));
const lim = [
  ["Dữ liệu giả lập do IBM tạo, không phải hồ sơ của một công ty thật", "Mọi phát hiện", "Tỷ lệ và độ lớn chênh lệch có thể không phản ánh doanh nghiệp thật nào; chỉ nên dùng kết quả như giả thuyết cần kiểm chứng trên dữ liệu nội bộ."],
  ["Ảnh chụp một thời điểm, không rõ “nghỉ việc” được tính trong bao lâu, không có ngày nghỉ", "PH2 (thâm niên)", "Người mới vào có ít thời gian để “được quan sát” nghỉ — nếu cửa sổ quan sát dài hơn với người thâm niên cao, chênh lệch 4,3 lần có thể bị phóng đại hoặc thu nhỏ; không ước lượng được bằng dữ liệu này."],
  ["OverTime chỉ là Có/Không; StandardHours là hằng số nên không có số giờ làm thực tế", "PH1 (làm thêm giờ)", "Không biết 30,5% thuộc về người làm thêm 2 giờ hay 20 giờ/tuần; không xác định được ngưỡng giờ làm cần can thiệp."],
  ["Các biến được đo cùng lúc với trạng thái nghỉ: người sắp nghỉ có thể chấm điểm hài lòng thấp hơn, ít được giao cổ phiếu hơn", "PH1, PH5, các biến hài lòng", "Chiều ảnh hưởng có thể ngược lại (nghỉ → chấm thấp), nên mối liên hệ với các biến hài lòng có thể bị phóng đại."],
  ["Trùng lặp hoàn toàn giữa độc thân và StockOptionLevel = 0; Sales Representative gần như toàn cấp 1", "PH4, PH5", "Không thể tách ảnh hưởng — mức độ sai lệch có thể là toàn bộ chênh lệch của một trong hai biến."],
  ["Nhóm nhỏ: cấp 4 chỉ 5 người nghỉ, Sales Representative 83 người, cấp 5 làm thêm giờ 18 người", "PH3 (cấp 4), PH4", "Tỷ lệ ở các ô này có thể dao động ±5–10 điểm % chỉ do ngẫu nhiên."],
  ["Không có lý do nghỉ (tự nguyện, bị cho thôi việc, nghỉ hưu)", "Mọi phát hiện", "Nhóm 40–60 tuổi có thể chứa người nghỉ hưu — gộp chung với nghỉ tự nguyện làm mờ đi tín hiệu cần giữ chân."],
];
C.push(table(["Giới hạn cụ thể", "Kết luận bị đe doạ", "Mức độ có thể làm lệch câu trả lời"], lim, [3.3, 1.5, 4.2], { size: 15 }));
C.push(caption("Bảng 7. Giới hạn của phân tích, gắn với từng phát hiện (PH = phát hiện ở Mục 5)."));
C.push(H2("6.2. Bước tiếp theo"));
C.push(B("**Thu thập thêm:** số giờ làm thêm thực tế mỗi tháng; ngày vào làm và ngày nghỉ (để tính thời gian đến khi nghỉ — phân tích sống còn); lý do nghỉ từ phỏng vấn thôi việc; lịch sử thay đổi lương và thăng chức; tiêu chí cấp quyền chọn cổ phiếu."));
C.push(B("**Kiểm định (Tuần 9):** kiểm định chi bình phương cho bảng làm thêm giờ × nghỉ việc trong từng cấp bậc; khoảng tin cậy cho tỷ lệ nghỉ của Sales Representative."));
C.push(B("**Mô hình (Tuần 10–11):** hồi quy logistic với đồng thời làm thêm giờ, cấp bậc, tuổi, thâm niên để ước lượng ảnh hưởng của từng biến khi giữ các biến khác cố định; xử lý mất cân bằng lớp (16% so với 84%)."));
C.push(B("**Nếu triển khai thực tế:** thử nghiệm có nhóm đối chứng (A/B) việc giới hạn làm thêm giờ cho nhân viên cấp 1 — cách duy nhất để chuyển từ “đi kèm” sang “gây ra”."));
C.push(H2("Phụ lục — Tái lập kết quả"));
C.push(P("Đặt notebooks/eda_attrition.ipynb cùng thư mục với EmployeeAttrition.csv. Cài thư viện: pip install -r requirements.txt (pandas, numpy, matplotlib, seaborn). Mở notebook, chọn Kernel → Restart & Run All: mọi bảng (nhật ký làm sạch, từ điển dữ liệu, thống kê, ngoại lai) và 8 hình hiển thị ngay trong notebook, notebook không ghi file nào khác. Mọi số liệu trong báo cáo được sinh từ notebook; phép xoá ngẫu nhiên 10% dòng dùng random_state = 1 đến 5 nên chạy lại cho đúng kết quả cũ.", { noIndent: true }));

// ---------- tài liệu ----------
const doc = new Document({
  creator: "Phan Hoàng Bách", title: "Báo cáo EDA — IBM HR Attrition",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: "111111" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 25, bold: true, italics: true, color: "333333" }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] },
    { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 320 } }, run: { bold: true } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1247, bottom: 1134, left: MARGIN_L, right: MARGIN_R } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: "INFO3020 · Báo cáo EDA giữa kỳ · Trang ", size: 18, color: "666666" }),
      new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "666666" })] })] }) },
    children: C,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  const out = path.join(ROOT, "report", "BaoCao_EDA_GiuaKy_PhanHoangBach.docx");
  fs.writeFileSync(out, buf); console.log("Đã ghi", out);
});
