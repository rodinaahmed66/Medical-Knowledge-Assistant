import time
from prometheus_client import Histogram, Counter, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Metric to track total duration per endpoint
HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "Total time spent per endpoint in seconds",
    ["method", "endpoint", "status"],
    # Buckets designed for fast APIs and slow LLM/Upload tasks
    buckets=(0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, float("inf"))
)

class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Start the timer
        start_time = time.perf_counter()
        
        # Fallback endpoint name
        endpoint = request.url.path 
        
        try:
            # 2. Process the request (runs your code in upload.py or chat.py)
            response = await call_next(request)
            status_code = response.status_code
            
            # Get the generic route path (e.g., /chat/ask) instead of the raw URL
            route = request.scope.get("route")
            if route:
                endpoint = route.path
                
            return response

        except Exception as e:
            status_code = 500
            raise e
        
        finally:
            # 3. Calculate total time
            duration = time.perf_counter() - start_time
            
            # 4. Save to Prometheus (exclude the metrics endpoint itself)
            if endpoint != "/informations":
                HTTP_REQUEST_DURATION.labels(
                    method=request.method, 
                    endpoint=endpoint, 
                    status=status_code
                ).observe(duration)

def setup_metrics(app):
    app.add_middleware(PrometheusMiddleware)

    @app.get("/informations", include_in_schema=False)
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)