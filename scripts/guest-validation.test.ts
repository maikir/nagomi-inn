import { expect, test } from "bun:test";
import { validGuestName, validGuestEmail, validGuestPhone, normalizeGuestPhone } from "../src/lib/reservations/validation";

test.each(["山田 太郎", "Anne-Marie O’Neill", "José", "김민수", "محمد علي", "สมชาย", "李小龍", "Søren", "Jean・Luc", "A", "किरण", "Nguyễn Thị Minh"])("accepts international name %s", name => {
  expect(validGuestName(name)).toBe(true);
});
test.each(["", " ", "123", "Alice123", "山田１２３", "Alice😀", "<script>", "Alice\nBob"])("rejects non-name input %s", name => {
  expect(validGuestName(name)).toBe(false);
});
test.each(["guest@example.com", "guest+booking@example.co.jp", " first.last@example.com "])("accepts email %s", email => {
  expect(validGuestEmail(email)).toBe(true);
});
test.each(["", "guest", "guest@", "guest@example", "a b@example.com", "a@@example.com", "a@-example.com", "a@ex..com", ".a@example.com", "a..b@example.com"])("rejects malformed email %s", email => {
  expect(validGuestEmail(email)).toBe(false);
});
test.each(["", "09012345678", "+81 90-1234-5678", "+1 (415) 555-0123", "０９０－１２３４－５６７８", "٠٩٠١٢٣٤٥٦٧٨"])("accepts international phone %s", phone => {
  expect(validGuestPhone(phone)).toBe(true);
});
test.each(["hello", "090abcd5678", "123", "++819012345678", "8190+12345678", "1234567890123456"])("rejects invalid phone %s", phone => {
  expect(validGuestPhone(phone)).toBe(false);
});
test("normalizes full-width and Arabic digits without dropping the international prefix", () => {
  expect(normalizeGuestPhone(" ＋８１ ９０－１２３４－５６７８ ")).toBe("+81 90-1234-5678");
  expect(normalizeGuestPhone("٠٩٠١٢٣٤٥٦٧٨")).toBe("09012345678");
});
test("API values of the wrong type are rejected without throwing", () => {
  expect(validGuestName(123)).toBe(false);
  expect(validGuestEmail({})).toBe(false);
  expect(validGuestPhone([])).toBe(false);
});
