# v1.5.0 Production Smoke Test

仅在代码审计和全部自动测试通过后执行。使用专用测试账号和无敏感内容的 `test-document.pdf`；禁止使用护照、签证、订单、二维码或真实个人文件。

## 前置检查

1. 在 Supabase Dashboard 确认 `travel-documents` Bucket 为 **Private**。
2. 确认前端配置只有 Publishable key；没有 secret 或 `service_role` key。
3. 使用独立浏览器 Profile，打开 DevTools 的 Network、Application 和 Console。
4. 准备专用测试账号，以及只包含文本 `Malaysia Bali v1.5.0 production smoke test` 的 `test-document.pdf`。

## 执行

1. 未登录访问 `Document Center`。
   - 预期：只显示登录页；页面、Console、localStorage 和 Cache Storage 中没有私人文档元数据或 signed URL。
2. 登录专用测试账号。
   - 预期：进入 Private Mode；Console 无错误。
3. 上传 `test-document.pdf`：分类选 `Hotels`，关联选 `Hilton Bali Resort`。
4. 在 Supabase Dashboard 核对：
   - `travel-documents` 中存在该对象；
   - `travel_documents` 中存在该记录；
   - `related_item_id = hotel-hilton-bali`；
   - `uploaded_by` 等于测试账号用户 ID。
5. 点击“查看”，在 Network 中检查签发请求 body 为 `{"expiresIn":60}`，文件能够打开；再次点击必须出现新的签发请求。
6. 退出登录。
   - 预期：私人列表和统计立即清空，Private Mode 关闭，重新进入 Document Center 要求登录；localStorage、sessionStorage 和 Cache Storage 中没有 signed URL 或文档数据。
7. 重新登录，删除测试文件。
   - 预期：Storage 对象与 `travel_documents` 记录都消失。
8. 重新上传同名安全测试文件，记录其 `travel_documents.id` 和 `storage_path`；在 Supabase Dashboard 只删除 Storage 对象，再从应用删除对应记录。
   - 预期：Storage 404/不存在不阻塞，元数据删除成功。
9. 退出账号并完成清理复查。
   - 预期：测试账号下不存在 `test-document.pdf` 对象或测试元数据；Console 无错误。

## 安全复查

1. 未登录状态直接请求 `travel_documents` SELECT，预期被拒绝或返回不可访问结果。
2. 未登录状态尝试读取、上传、删除 `travel-documents` 对象，预期全部被拒绝。
3. 使用第二个测试账号访问第一个账号的对象路径和记录，预期被 RLS 拒绝。
4. Application → Cache Storage 中搜索 `travel_documents`、`storage/v1`、`token=`，预期无结果。
5. 检查响应安全头与现有 CSP，确认没有因本版本修改而缺失。

## 通过标准

上述步骤全部符合预期、Console 无错误、无测试垃圾数据残留，才可记录为 `PRODUCTION E2E PASS`。失败时停止发布并保留失败步骤、HTTP 状态和时间戳；不要保留文件内容或账号凭据。
