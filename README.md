# INFO3020 · Bài tập lớn — Phân tích và dự đoán nghỉ việc của nhân viên (IBM HR Attrition)

**Sinh viên:** Phan Hoàng Bách (làm một mình, đã được giảng viên đồng ý)  
**Repository:** https://github.com/bachph2005-hash/INFO3020-EDA-Attrition  
**Câu hỏi nghiên cứu:** (1) Nhóm nhân viên nào có tỷ lệ nghỉ việc cao nhất, và yếu tố nào vẫn gắn với nghỉ việc khi so sánh trong cùng cấp bậc? (2) Có thể dự đoán người có nguy cơ nghỉ đủ tốt để phòng Nhân sự ưu tiên hỗ trợ không?

## Cấu trúc

```
data/raw/EmployeeAttrition.csv        dữ liệu gốc (không sửa)
notebooks/eda_attrition.ipynb         notebook chính — Restart & Run All; mọi bảng, biểu đồ hiện ngay trong notebook
notebooks/EmployeeAttrition.csv       bản sao dữ liệu đặt cạnh notebook (notebook đọc file này)
src/eda_attrition.py                  cùng nội dung notebook, dạng script (dựng bằng jupytext từ notebook)
outputs/, data/processed/             hình và bảng đã dùng để dựng báo cáo (notebook không ghi ra các file này)
report/BaoCao_BaiTapLon_*.pdf/.docx   báo cáo bài tập lớn (khung theo rubric)
report/build_final_report.js          script tạo báo cáo bài tập lớn; model_results.json là số liệu xuất từ notebook
report/cmc_cover.py                   dựng lại báo cáo từ script theo mẫu CMC (ghi đè file Word đã sửa tay — chỉ chạy khi cần)
report/toc_field.py, export_pdf.py    đổi mục lục gõ tay thành mục lục tự động của Word; xuất PDF có cập nhật mục lục
report/BaoCao_EDA_GiuaKy_*            báo cáo giữa kỳ (giữ lại để tham khảo)
```

## Nội dung notebook

1–8: nạp dữ liệu, đánh giá chất lượng, làm sạch có nhật ký, ngoại lai, từ điển dữ liệu, thống kê mô tả, phân tích theo nhóm và biến gây nhiễu, kiểm tra độ vững, năm biểu đồ chính.  
9: kiểm định giả thuyết (chi bình phương, Mann–Whitney; độ lớn hiệu ứng, khoảng tin cậy 95%, p-value).  
10–14: mô hình phân loại — chia 80/20 phân tầng, Pipeline chuẩn hoá và mã hoá, 6 đặc trưng mới, so sánh mô hình mốc / hồi quy logistic / Random Forest bằng kiểm định chéo 5 phần, chọn ngưỡng theo recall ≥ 70%, đánh giá trên tập kiểm tra, hệ số, rà soát rò rỉ dữ liệu.  
15: kết quả theo nhóm (giới tính, tuổi, phòng ban) và đạo đức dữ liệu.  
16: sản phẩm đầu ra — danh sách nhân viên nguy cơ cao, bản đồ nguy cơ theo phòng ban × cấp bậc, kịch bản mô phỏng.

## Chạy lại

```bash
pip install -r requirements.txt
jupyter notebook notebooks/eda_attrition.ipynb   # Kernel → Restart Kernel and Run All Cells (khoảng 1–2 phút)
```

Notebook chỉ đọc `EmployeeAttrition.csv` nằm cùng thư mục, không ghi file nào. Các phép ngẫu nhiên cố định `random_state` (42 cho chia tập và kiểm định chéo; 1–5 cho kiểm tra độ vững). Cần pandas ≥ 2.1.

## Kết quả chính

1. Làm thêm giờ: nghỉ việc 30,5% so với 10,4% (chênh +20,1 điểm %, KTC 95% 15,3–24,9; p < 0,001), còn nguyên ở mọi cấp bậc.
2. Thâm niên 0–1 năm: 34,9% nghỉ, mạnh nhất ở người dưới 30 tuổi.
3. Thu nhập thấp đi kèm nghỉ việc chủ yếu do cấp bậc (ρ = 0,92); trong cùng cấp chênh lệch nhỏ.
4. Mô hình hồi quy logistic (ngưỡng 0,20) trên tập kiểm tra: recall 63,8%, precision 44,8%, ROC-AUC 0,812; phát hiện kém ở nhóm 40–60 tuổi (recall 38%).
5. Kịch bản: nếu nhân viên cấp 1 không làm thêm giờ, mô hình ước tính giảm khoảng 59 người nghỉ — là ước tính, không phải tác động đã chứng minh.

Mọi kết quả là mối liên hệ trong dữ liệu giả lập do IBM tạo, không phải quan hệ nhân quả.

## Khai báo sử dụng AI

Dự án có sử dụng Claude (Anthropic) làm công cụ hỗ trợ: giải thích khái niệm và bài giảng; viết khung code cho notebook (làm sạch, biểu đồ, mô hình) và gỡ lỗi; soạn bản nháp. Sinh viên: chọn đề tài và câu hỏi nghiên cứu; quyết định các lựa chọn phân tích (giữ ngoại lai, chọn độ đo chính, quy tắc chọn ngưỡng, loại giới tính khỏi mô hình); chạy lại toàn bộ notebook trên máy của mình và kiểm tra mọi con số trong báo cáo khớp với kết quả chạy. Mọi số liệu trong báo cáo được sinh từ notebook, không lấy từ công cụ AI.

## Nguồn dữ liệu

IBM HR Analytics Employee Attrition & Performance — Kaggle (pavansubhasht/ibm-hr-analytics-attrition-dataset), OpenML ID 43696. Dữ liệu giả lập do IBM tạo, dùng cho mục đích học tập.
