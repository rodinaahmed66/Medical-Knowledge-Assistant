from config.help import get_settings
from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase
from deepeval.models import LocalModel
from typing import List


class FaithfulnessJudge:

    def __init__(self):
        self.settings = get_settings()
        self.threshold = self.settings.THRESHOLD_FAITH
        self.judge_model = LocalModel(
            model=self.settings.JUDGE_MODEL_ID,
            base_url=self.settings.GROQ_URL,
            api_key=self.settings.GROQ_KEY,
            temperature=self.settings.GENERATION_DEFAULT_TEMPERATURE,
        )

        self.metric = FaithfulnessMetric(
            threshold=self.threshold,
            model=self.judge_model,
            include_reason=True
        )

    def build_test(self, query, actual_output, retrieval_context):
        test_case = LLMTestCase(
            input=query,
            actual_output=actual_output,
            retrieval_context=retrieval_context
        )
        self.metric.measure(test_case)
        return self.metric.score, self.metric.reason