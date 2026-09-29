<?php

// ZONES starts empty here and gets filled in on the client side, from the
// real mangrove/protected areas in Supabase (see mangrove-draw.js's
// loadMangroveAreas(), which pushes each one into this same ZONES array as
// it loads). This file's other job is unconditional — it always serves the
// rest of the zone/submission-handling script (connection status, aquafarm
// registry, etc.), which lives in zones-data-body.js.
header('Content-Type: application/javascript; charset=utf-8');

echo "const ZONES = [];\n\n";
readfile(__DIR__ . '/../js/zones-data-body.js');
