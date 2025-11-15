import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Auth route works ✅");
});

export default router;
