# Edupia Classroom Server

Một máy chủ dùng chung cho **mọi** game tạo bằng skill `build-classroom-game`. Triển khai một lần; game mới chỉ cần trỏ `serverUrl` vào đây.

## Chạy

```bash
npm ci
cp .env.example .env     # sửa các giá trị
npm start                # mặc định cổng 8080, WebSocket ở /ws
```
Đặt sau reverse proxy HTTPS (nginx/Cloudflare) và cho phép nâng cấp WebSocket ở `/ws`.

Thử trong mạng nội bộ, kèm phục vụ file game:
```bash
node server.js --games ../games      # mở http://<ip-máy>:8080/<ten-game>/teacher.html
```

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `PORT` | cổng HTTP/WS |
| `ALLOWED_ORIGINS` | origin của trang chứa game, phân tách bằng dấu phẩy. Kết nối từ origin khác bị từ chối |
| `TEACHER_KEY` | mã tạm cho giáo viên cho tới khi nối SSO |
| `ADMIN_TOKEN` | mã của chủ nội dung để vào `/admin` |
| `CONTENT_HOSTS` | host được phép đọc nguồn câu hỏi (ví dụ `docs.google.com`) |
| `DATA_DIR` | nơi lưu `sources.json` — cần ổ đĩa bền |
| `GAMES_DIR` | tùy chọn, phục vụ file game để thử nội bộ; không dùng cho production |

## Việc IT cần làm

1. **`auth.js` → `authenticateTeacher`**: thay bằng xác thực Edupia (cookie/JWT). Đây là chỗ duy nhất cần sửa; phần còn lại giữ nguyên để mọi game dùng chung.
2. **Quyền đọc nguồn**: mặc định máy chủ đọc bản xuất text của Google Docs. Cần giữ kín đáp án thì đổi `content-source.js` sang Drive/Sheets API với service account.
3. **Nhiều instance**: phòng đang nằm trong RAM. Dùng sticky session, hoặc chuyển `rooms` sang Redis trước khi scale ngang.
4. **Giám sát**: `GET /healthz` trả số phòng đang mở.

## Những gì đã có sẵn

Chấm điểm và hẹn giờ phía máy chủ, khóa `(roundId, playerId, questionId)` chống bấm kép, token phiên cho giáo viên và học sinh, nối lại sau mất mạng, vào muộn, lược đáp án trước khi gửi xuống máy học sinh, kiểm tra origin WebSocket, giới hạn 16 KB/tin và 20 tin/giây, tối đa 20 phòng mỗi giáo viên, dọn phòng bỏ trống, CSP cho file phục vụ tĩnh, trang `/admin` cho chủ nội dung.

## Giao thức

Xem `references/architecture.md` trong skill. Tóm tắt: client gửi `{v:1, id, op, payload}`, máy chủ trả `{type:'reply', id, ok, data|error}` và đẩy `{type:'snapshot', data}`. Máy chủ bỏ qua mọi `playerId`/`isCorrect`/`score` do client khai; nó chấm từ `answer` thô theo snapshot của vòng.
