const router = require('express').Router();
const { getPoolLpDepth } = require('../lib/lpDepth');

// GET /api/pool/:address/lpers
router.get('/:address/lpers', async (req, res, next) => {
  const { address } = req.params;
  try {
    const result = await getPoolLpDepth(address, req.app.locals);
    res.json(result);
  } catch (e) {
    // The positions fetch is the only required upstream call.
    return res
      .status(502)
      .json({ error: 'Failed to fetch positions', detail: e.message });
  }
});

module.exports = router;
