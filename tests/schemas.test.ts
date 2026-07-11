import { describe, expect, it } from "vitest";
import { loginSchema, schedulePickupSchema, signupSchema } from "../lib/schemas";

describe("input schemas", () => {
  it("accepts valid pickup form data", () => {
    expect(
      schedulePickupSchema.safeParse({
        waste_items: ["Plastic"],
        weight: 2.5,
        location: "Rishra",
        scheduled_date: "2026-07-10",
        time_slot: "10:00-12:00",
        address: "12 Green Lane",
        notes: "Call before pickup",
        pincode: "712248",
      }).success
    ).toBe(true);
  });

  it("rejects empty and invalid pickup form data", () => {
    expect(
      schedulePickupSchema.safeParse({
        waste_items: [],
        weight: 0,
        location: "Unknown",
        scheduled_date: "",
        time_slot: "",
      }).success
    ).toBe(false);
  });

  it("rejects invalid login credentials", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "" }).success).toBe(false);
  });

  it("rejects signup password mismatch", () => {
    expect(
      signupSchema.safeParse({
        full_name: "Asha Sen",
        email: "asha@example.com",
        password: "secret1",
        confirmPassword: "secret2",
      }).success
    ).toBe(false);
  });
});
