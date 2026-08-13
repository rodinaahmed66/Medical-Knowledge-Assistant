from types import SimpleNamespace

import pytest

from controllers.DataController import DataController
from models import ProcessSignal


def make_upload_file(content_type: str, size_bytes: int):
    """Minimal stand-in for fastapi.UploadFile — data_validate only reads
    .content_type and .size, so a SimpleNamespace is enough and keeps the
    test independent of fastapi's actual UploadFile constructor."""
    return SimpleNamespace(content_type=content_type, size=size_bytes)


@pytest.mark.parametrize(
    "content_type, size_bytes, expected_ok, expected_signal",
    [
        # wrong mime type, otherwise fine on size
        ("image/png", 1024, False, ProcessSignal.FILE_TYPE_NOT_SUPPORTED.value),
        # allowed type but over the configured Max_SIZE_FILE (10 MB in conftest)
        ("application/pdf", 11 * 1024 * 1024, False, ProcessSignal.FILE_SIZE_EXCEEDED.value),
        # allowed type, within size limit
        ("application/pdf", 1024, True, ProcessSignal.FILE_VALIDATED_SUCCESS.value),
    ],
)
def test_data_validate(content_type, size_bytes, expected_ok, expected_signal):
    controller = DataController()
    upload = make_upload_file(content_type, size_bytes)

    is_valid, signal = controller.data_validate(upload)

    assert is_valid is expected_ok
    assert signal == expected_signal


def test_generate_file_id_is_deterministic_per_filename():
    controller = DataController()

    first = controller.generate_file_id("report.pdf")
    second = controller.generate_file_id("report.pdf")
    different = controller.generate_file_id("other.pdf")

    assert first == second
    assert first != different
