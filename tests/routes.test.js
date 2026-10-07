import test from "node:test";
import assert from "node:assert/strict";
import { pageUrl, parsePath } from "../js/core/router.js";
test("role folders map to html pages", () => {
  assert.equal(pageUrl("nutritionist", "analysis"), "/nutritionist/analysis.html");
  assert.equal(pageUrl("player", "camera"), "/athlete/camera.html");
  assert.equal(pageUrl("coach", "dashboard"), "/coach/dashboard.html");
  assert.equal(pageUrl("coach", "login"), "/login/index.html");
  assert.equal(pageUrl("player", "kiosk"), "/kiosk/index.html");
});
test("html paths resolve back to role and page", () => {
  assert.deepEqual(parsePath("/nutritionist/analysis.html"), {
    role: "nutritionist",
    route: "analysis",
  });
  assert.deepEqual(parsePath("/athlete/profile.html"), {
    role: "player",
    route: "profile",
  });
  assert.deepEqual(parsePath("/coach/records.html"), {
    role: "coach",
    route: "records",
  });
  assert.deepEqual(parsePath("/login/index.html", "coach"), {
    role: "coach",
    route: "login",
  });
  assert.equal(parsePath("/kiosk/index.html").route, "kiosk");
});
