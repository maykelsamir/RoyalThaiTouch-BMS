"""Compatibility router for styled financial-report exports.

The primary PDF export is implemented in ``reports.py``.  This module remains
importable so application startup is not blocked when optional styled-report
helpers are unavailable.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/reports", tags=["reports"])
