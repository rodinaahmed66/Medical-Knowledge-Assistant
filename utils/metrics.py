from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time

# Define metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP Requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP Request Latency', ['method', 'endpoint'])


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()  # Highly accurate clock for measuring latency
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as e:
            # If an unhandled exception occurs inside the app, ensure it gets logged as a 500 error
            status_code = 500
            raise e
        finally:
            duration = time.perf_counter() - start_time
            
            # Resolve the matched route pattern to prevent high-cardinality in Prometheus
            route = request.scope.get("route")
            if route:
                endpoint = route.path  # e.g., returns "/upload/file/{file_id}" instead of raw UUIDs
            else:
                endpoint = request.url.path  # Fallback for static files or unresolved 404s

            REQUEST_LATENCY.labels(method=request.method, endpoint=endpoint).observe(duration)
            REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, status=status_code).inc()


def setup_metrics(app: FastAPI):
    app.add_middleware(PrometheusMiddleware)
    
    @app.get("/informations", include_in_schema=False)
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)