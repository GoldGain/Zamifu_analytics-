#!/bin/bash
# Quick headless test of the compact report card layout using ts-node-style logic.
# We build a minimal Node script that imports jspdf + jspdf-autotable and simulates
# the draw sequence with dummy data to measure final page count.
set -e
cd /home/ubuntu/zamifu
