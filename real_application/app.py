#!/usr/bin/env python3
"""
Real Network Traffic Generator Application
This application interacts with various external APIs (Poem, JSONPlaceholder, Weather)
and generates network traffic logs for the NIDS dashboard to analyze.
"""

import requests
import time
import logging
import json
import threading
from datetime import datetime, timezone
from urllib.parse import urlparse
from flask import Flask, render_template_string, jsonify
from flask import request as flask_request
import random
import psutil
import socket
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('real_application.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# API endpoints - Expanded list for diverse network traffic
APIS = {
    'jsonplaceholder': {
        'posts': 'https://jsonplaceholder.typicode.com/posts',
        'users': 'https://jsonplaceholder.typicode.com/users',
        'comments': 'https://jsonplaceholder.typicode.com/comments',
        'albums': 'https://jsonplaceholder.typicode.com/albums',
        'photos': 'https://jsonplaceholder.typicode.com/photos',
        'todos': 'https://jsonplaceholder.typicode.com/todos'
    },
    'poem': {
        'random': 'https://poetrydb.org/random',
        'author': 'https://poetrydb.org/author/shakespeare',
        'title': 'https://poetrydb.org/title/Ozymandias',
        'lines': 'https://poetrydb.org/lines'
    },
    'weather': {
        'current': 'https://api.openweathermap.org/data/2.5/weather',
        'forecast': 'https://api.openweathermap.org/data/2.5/forecast'
    },
    'httpbin': {
        'get': 'https://httpbin.org/get',
        'post': 'https://httpbin.org/post',
        'put': 'https://httpbin.org/put',
        'delete': 'https://httpbin.org/delete',
        'patch': 'https://httpbin.org/patch',
        'headers': 'https://httpbin.org/headers',
        'status': 'https://httpbin.org/status',
        'delay': 'https://httpbin.org/delay'
    },
    'restcountries': {
        'all': 'https://restcountries.com/v3.1/all',
        'name': 'https://restcountries.com/v3.1/name',
        'region': 'https://restcountries.com/v3.1/region'
    },
    'quotable': {
        'random': 'https://api.quotable.io/random',
        'quotes': 'https://api.quotable.io/quotes',
        'authors': 'https://api.quotable.io/authors'
    },
    'catfacts': {
        'facts': 'https://catfact.ninja/fact',
        'breeds': 'https://catfact.ninja/breeds'
    },
    'dogapi': {
        'random': 'https://dog.ceo/api/breeds/image/random',
        'list': 'https://dog.ceo/api/breeds/list/all'
    },
    'ipapi': {
        'ip': 'https://ipapi.co/json/',
        'ipv4': 'https://api.ipify.org?format=json',
        'ipv6': 'https://api64.ipify.org?format=json'
    },
    'geocoding': {
        'forward': 'https://nominatim.openstreetmap.org/search',
        'reverse': 'https://nominatim.openstreetmap.org/reverse'
    },
    # Cloud Services APIs - Real endpoints that generate network traffic
    'aws': {
        # AWS S3 public bucket example
        's3_bucket': 'https://s3.amazonaws.com',
        # AWS status page
        'status': 'https://status.aws.amazon.com/data.json',
        # AWS CloudFront CDN
        'cloudfront': 'https://d1.awsstatic.com',
        # AWS API Gateway public endpoint
        'api_gateway': 'https://execute-api.us-east-1.amazonaws.com/v1/example',
    },
    'azure': {
        # Azure status API
        'status': 'https://status.azure.com/en-us/status',
        # Azure CDN
        'cdn': 'https://azure.microsoft.com',
        # Azure Functions public
        'functions': 'https://functions.azure.com',
    },
    'gcp': {
        # Google Cloud status
        'status': 'https://status.cloud.google.com/incidents.json',
        # Google Cloud Storage public
        'storage': 'https://storage.googleapis.com',
        # Google Cloud Functions
        'functions': 'https://cloudfunctions.googleapis.com',
    },
    'cloudflare': {
        # Cloudflare CDN (serves many websites)
        'cdn': 'https://www.cloudflare.com',
        # Cloudflare Workers
        'workers': 'https://workers.cloudflare.com',
        # Cloudflare API (public endpoints)
        'api': 'https://api.cloudflare.com/client/v4/ips',
        # Cloudflare status
        'status': 'https://www.cloudstatus.com/api/v2/status.json',
    },
    'fastly': {
        # Fastly CDN (serves many websites)
        'cdn': 'https://www.fastly.com',
        # Fastly status
        'status': 'https://status.fastly.com/api/v2/status.json',
    },
    'vercel': {
        # Vercel deployment platform
        'platform': 'https://vercel.com',
        # Vercel API
        'api': 'https://api.vercel.com/v1',
    },
    'github': {
        # GitHub API (public endpoints)
        'api': 'https://api.github.com',
        # GitHub content via CDN
        'cdn': 'https://github.githubassets.com',
        # GitHub status
        'status': 'https://www.githubstatus.com/api/v2/status.json',
    },
    'gitlab': {
        # GitLab API
        'api': 'https://gitlab.com/api/v4',
        # GitLab CDN
        'cdn': 'https://assets.gitlab-static.net',
    },
    'digitalocean': {
        # DigitalOcean API
        'api': 'https://api.digitalocean.com/v2',
        # DigitalOcean CDN
        'cdn': 'https://www.digitalocean.com',
    },
    'heroku': {
        # Heroku status
        'status': 'https://status.heroku.com/api/v4/current-status',
        # Heroku platform
        'platform': 'https://www.heroku.com',
    },
    'netlify': {
        # Netlify API
        'api': 'https://api.netlify.com/api/v1',
        # Netlify CDN
        'cdn': 'https://www.netlify.com',
    },
    'jsonplaceholder': {
        # This goes through Cloudflare CDN
        'posts': 'https://jsonplaceholder.typicode.com/posts',
        'users': 'https://jsonplaceholder.typicode.com/users',
        'comments': 'https://jsonplaceholder.typicode.com/comments',
    }
}

# Network traffic log file
NETWORK_LOG_FILE = 'network_traffic.log'

def get_local_ip():
    """Get local IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

LOCAL_IP = get_local_ip()

def log_network_traffic(url, method, response_code, response_time, bytes_sent, bytes_received, 
                       protocol="HTTP/1.1", network_metadata=None):
    """Log comprehensive network traffic data to file and send to dashboard."""
    try:
        # Extract URL components
        parsed_url = urlparse(url)
        
        # Build comprehensive traffic entry with all available network data
        traffic_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": "api_call",
            "target_url": url,
            "method": method,
            "response_code": response_code,
            "response_time_ms": response_time,
            "bytes_sent": bytes_sent,
            "bytes_received": bytes_received,
            "source_ip": LOCAL_IP,
            "protocol": protocol,
            # URL components
            "scheme": parsed_url.scheme,
            "hostname": parsed_url.hostname,
            "port": parsed_url.port or (443 if parsed_url.scheme == 'https' else 80),
            "path": parsed_url.path,
            "query": parsed_url.query,
            # Network metadata
            "connection_type": network_metadata.get('connection') if network_metadata else None,
            "http_version": network_metadata.get('http_version') if network_metadata else protocol,
            "request_headers": network_metadata.get('request_headers') if network_metadata else {},
            "response_headers": network_metadata.get('response_headers') if network_metadata else {},
            "user_agent": network_metadata.get('user_agent') if network_metadata else None,
            "content_type": network_metadata.get('content_type') if network_metadata else None,
            "content_encoding": network_metadata.get('content_encoding') if network_metadata else None,
            "server": network_metadata.get('server') if network_metadata else None,
            "cache_control": network_metadata.get('cache_control') if network_metadata else None,
            "dns_time_ms": network_metadata.get('dns_lookup_time', 0) if network_metadata else 0,
            "tcp_connect_time_ms": network_metadata.get('tcp_connect_time', 0) if network_metadata else 0,
            "ssl_handshake_time_ms": network_metadata.get('ssl_handshake_time', 0) if network_metadata else 0,
            "redirect_count": network_metadata.get('redirect_count', 0) if network_metadata else 0,
            "redirect_url": network_metadata.get('redirect_url') if network_metadata else None,
            "is_secure": parsed_url.scheme == 'https',
            "request_id": network_metadata.get('request_id') if network_metadata else None,
        }
        
        # Log to file
        with open(NETWORK_LOG_FILE, 'a') as f:
            f.write(json.dumps(traffic_entry) + '\n')
        
        # Send to dashboard via backend API
        send_to_dashboard(traffic_entry)
        
        logger.debug(f"Logged comprehensive traffic: {method} {url} -> {response_code}")
    except Exception as e:
        logger.error(f"Failed to log network traffic: {str(e)}")

def send_to_dashboard(log_entry):
    """Send log entry to dashboard backend API."""
    try:
        # Convert log entry to JSON string format for the API
        log_line = json.dumps(log_entry)
        
        # Send to backend log analysis API
        response = requests.post(
            'http://localhost:8000/api/v1/log-analysis/logs/submit',
            json={
                "log_lines": [log_line],
                "log_format": "json",
                "source_name": "real_application",
                "real_time": True
            },
            timeout=2
        )
        
        if response.status_code == 200:
            logger.debug("Log sent to dashboard successfully")
        else:
            logger.warning(f"Failed to send log to dashboard: {response.status_code}")
    except requests.exceptions.ConnectionError:
        # Backend not available yet, that's okay
        pass
    except Exception as e:
        logger.debug(f"Dashboard API call failed (non-critical): {str(e)}")

def call_api(url, method='GET', params=None, headers=None, timeout=10):
    """Make an API call and log comprehensive network traffic data."""
    start_time = time.time()
    bytes_sent = 0
    bytes_received = 0
    response_code = 500
    network_metadata = {}
    
    # Default headers with User-Agent
    default_headers = {
        'User-Agent': 'Real-Application/1.0 (Network Traffic Generator)',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
    }
    if headers:
        default_headers.update(headers)
    
    try:
        # Prepare request data for size calculation
        request_data = None
        if params:
            if method == 'POST':
                request_data = json.dumps(params) if isinstance(params, dict) else str(params)
            else:
                request_data = str(params)
        
        # Calculate request size accurately (headers + body + request line)
        request_line = f"{method} {url} HTTP/1.1\r\n"
        headers_string = "\r\n".join(f"{k}: {v}" for k, v in default_headers.items())
        headers_size = len((headers_string + "\r\n\r\n").encode('utf-8'))
        body_size = len(request_data.encode('utf-8')) if request_data else 0
        request_line_size = len(request_line.encode('utf-8'))
        bytes_sent = request_line_size + headers_size + body_size
        
        # Make the request
        request_start = time.time()
        if method == 'GET':
            response = requests.get(url, params=params, headers=default_headers, timeout=timeout, verify=False, allow_redirects=True)
        elif method == 'POST':
            response = requests.post(url, json=params, headers=default_headers, timeout=timeout, verify=False, allow_redirects=True)
        elif method in ['PUT', 'PATCH']:
            response = requests.request(method, url, json=params, headers=default_headers, timeout=timeout, verify=False, allow_redirects=True)
        else:
            response = requests.request(method, url, params=params, headers=default_headers, timeout=timeout, verify=False, allow_redirects=True)
        
        response_time = int((time.time() - start_time) * 1000)
        response_code = response.status_code
        bytes_received = len(response.content) if response.content else 0
        
        # Extract comprehensive network metadata
        network_metadata = {
            'connection': response.headers.get('Connection', 'close'),
            'http_version': 'HTTP/1.1',  # requests library doesn't expose HTTP/2 directly
            'request_headers': dict(default_headers),
            'response_headers': dict(response.headers),
            'user_agent': default_headers.get('User-Agent'),
            'content_type': response.headers.get('Content-Type'),
            'content_encoding': response.headers.get('Content-Encoding'),
            'server': response.headers.get('Server'),
            'cache_control': response.headers.get('Cache-Control'),
            'redirect_count': len(response.history),
            'redirect_url': response.url if response.url != url else None,
            'final_url': response.url,
            'request_id': f"{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
            'is_redirected': response.url != url,
            'cookies': dict(response.cookies) if response.cookies else {},
            'response_encoding': response.encoding,
            'elapsed_time_total': response.elapsed.total_seconds() * 1000,
            'elapsed_time_resolve': getattr(response.elapsed, 'resolve', 0) * 1000 if hasattr(response.elapsed, 'resolve') else 0,
            'elapsed_time_connect': getattr(response.elapsed, 'connect', 0) * 1000 if hasattr(response.elapsed, 'connect') else 0,
        }
        
        # Try to estimate DNS and connection times from elapsed object
        if hasattr(response.elapsed, 'total_seconds'):
            total = response.elapsed.total_seconds() * 1000
            # Rough estimates if detailed timing not available
            network_metadata['dns_lookup_time'] = max(1, int(total * 0.1))  # ~10% of total time
            network_metadata['tcp_connect_time'] = max(2, int(total * 0.15))  # ~15% of total time
            if url.startswith('https'):
                network_metadata['ssl_handshake_time'] = max(5, int(total * 0.2))  # ~20% for HTTPS
            else:
                network_metadata['ssl_handshake_time'] = 0
        
        # Determine protocol
        protocol = "HTTPS/1.1" if url.startswith('https') else "HTTP/1.1"
        
        # Log comprehensive network traffic
        log_network_traffic(url, method, response_code, response_time, bytes_sent, bytes_received, protocol, network_metadata)
        
        return response
    except requests.exceptions.Timeout:
        response_time = int((time.time() - start_time) * 1000)
        network_metadata['timeout'] = True
        network_metadata['error'] = 'Request timeout'
        log_network_traffic(url, method, 504, response_time, bytes_sent, 0, "HTTP/1.1", network_metadata)
        logger.debug(f"API call timeout: {url}")
        return None
    except requests.exceptions.RequestException as e:
        response_time = int((time.time() - start_time) * 1000)
        network_metadata['error'] = str(e)
        network_metadata['error_type'] = type(e).__name__
        log_network_traffic(url, method, 500, response_time, bytes_sent, 0, "HTTP/1.1", network_metadata)
        logger.debug(f"API call failed: {str(e)}")
        return None
    except Exception as e:
        response_time = int((time.time() - start_time) * 1000)
        network_metadata['error'] = str(e)
        network_metadata['error_type'] = type(e).__name__
        log_network_traffic(url, method, 500, response_time, bytes_sent, 0, "HTTP/1.1", network_metadata)
        logger.error(f"Unexpected error in API call: {str(e)}")
        return None

@app.route('/')
def index():
    """Main application page."""
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Real Network Traffic Generator</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container {
                background: white;
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            h1 {
                color: #333;
                border-bottom: 3px solid #667eea;
                padding-bottom: 10px;
            }
            .status {
                display: flex;
                gap: 20px;
                margin: 20px 0;
                flex-wrap: wrap;
            }
            .status-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                flex: 1;
                min-width: 200px;
            }
            .status-card h3 {
                margin: 0 0 10px 0;
                font-size: 0.9rem;
                text-transform: uppercase;
                opacity: 0.9;
            }
            .status-card .value {
                font-size: 2rem;
                font-weight: bold;
            }
            .apis {
                margin-top: 30px;
            }
            .api-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 15px 0;
                border-left: 4px solid #667eea;
            }
            .api-section h3 {
                color: #667eea;
                margin-top: 0;
            }
            button {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1rem;
                margin: 5px;
                transition: all 0.3s;
            }
            button:hover {
                background: #764ba2;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            button:active {
                transform: translateY(0);
            }
            .result {
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 15px;
                margin-top: 10px;
                max-height: 300px;
                overflow-y: auto;
                font-family: monospace;
                font-size: 0.9rem;
            }
            .auto-mode {
                background: #28a745;
            }
            .auto-mode.active {
                background: #dc3545;
            }
            .logs {
                margin-top: 30px;
            }
            .log-entry {
                background: #f8f9fa;
                padding: 10px;
                margin: 5px 0;
                border-radius: 4px;
                border-left: 3px solid #667eea;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Real Network Traffic Generator</h1>
            <p>This application interacts with external APIs and generates network traffic logs that the NIDS dashboard analyzes.</p>
            
            <div class="status">
                <div class="status-card">
                    <h3>Status</h3>
                    <div class="value" id="status">Running</div>
                </div>
                <div class="status-card">
                    <h3>API Calls</h3>
                    <div class="value" id="apiCount">0</div>
                </div>
                <div class="status-card">
                    <h3>Local IP</h3>
                    <div class="value" style="font-size: 1.2rem;">{{ local_ip }}</div>
                </div>
            </div>

            <div class="apis">
                <h2>Available APIs</h2>
                
                <div class="api-section">
                    <h3>📝 JSONPlaceholder API</h3>
                    <button onclick="callAPI('jsonplaceholder', 'posts')">Get Posts</button>
                    <button onclick="callAPI('jsonplaceholder', 'users')">Get Users</button>
                    <button onclick="callAPI('jsonplaceholder', 'comments')">Get Comments</button>
                    <div id="jsonplaceholder-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>📖 Poetry DB API</h3>
                    <button onclick="callAPI('poem', 'random')">Random Poem</button>
                    <button onclick="callAPI('poem', 'author')">Shakespeare Poems</button>
                    <button onclick="callAPI('poem', 'title')">Ozymandias</button>
                    <div id="poem-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>🌤️ Weather API</h3>
                    <button onclick="callAPI('weather', 'current')">Current Weather</button>
                    <div id="weather-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>🧪 HTTPBin (Test Different Methods)</h3>
                    <button onclick="callEndpoint('/api/httpbin/get', 'GET')">GET Request</button>
                    <button onclick="callEndpoint('/api/httpbin/post', 'POST')">POST Request</button>
                    <button onclick="callEndpoint('/api/httpbin/put', 'PUT')">PUT Request</button>
                    <button onclick="callEndpoint('/api/httpbin/delete', 'DELETE')">DELETE Request</button>
                    <button onclick="callEndpoint('/api/httpbin/patch', 'PATCH')">PATCH Request</button>
                    <button onclick="callEndpoint('/api/httpbin/delay/2', 'GET')">Delayed (2s)</button>
                    <div id="httpbin-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>🌍 REST Countries API</h3>
                    <button onclick="callEndpoint('/api/countries/all', 'GET')">All Countries</button>
                    <button onclick="callEndpoint('/api/countries/usa', 'GET')">Get USA</button>
                    <button onclick="callEndpoint('/api/countries/japan', 'GET')">Get Japan</button>
                    <div id="countries-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>💬 Quotes & Facts</h3>
                    <button onclick="callEndpoint('/api/quote/random', 'GET')">Random Quote</button>
                    <button onclick="callEndpoint('/api/cat/fact', 'GET')">Cat Fact</button>
                    <button onclick="callEndpoint('/api/dog/random', 'GET')">Random Dog</button>
                    <button onclick="callEndpoint('/api/ip/info', 'GET')">IP Info</button>
                    <div id="quotes-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>☁️ Cloud Services - Real Endpoints</h3>
                    <h4>AWS</h4>
                    <button onclick="callEndpoint('/api/aws/s3', 'GET')">AWS S3</button>
                    <button onclick="callEndpoint('/api/aws/cloudfront', 'GET')">AWS CloudFront CDN</button>
                    <button onclick="callEndpoint('/api/aws/status', 'GET')">AWS Status API</button>
                    <h4>Azure</h4>
                    <button onclick="callEndpoint('/api/azure/status', 'GET')">Azure Status API</button>
                    <button onclick="callEndpoint('/api/azure/cdn', 'GET')">Azure CDN</button>
                    <h4>Google Cloud</h4>
                    <button onclick="callEndpoint('/api/gcp/status', 'GET')">GCP Status API</button>
                    <button onclick="callEndpoint('/api/gcp/storage', 'GET')">GCP Storage</button>
                    <h4>CDN Services</h4>
                    <button onclick="callEndpoint('/api/cloudflare/cdn', 'GET')">Cloudflare CDN</button>
                    <button onclick="callEndpoint('/api/cloudflare/ips', 'GET')">Cloudflare IPs API</button>
                    <button onclick="callEndpoint('/api/cloudflare/status', 'GET')">Cloudflare Status</button>
                    <button onclick="callEndpoint('/api/fastly/cdn', 'GET')">Fastly CDN</button>
                    <button onclick="callEndpoint('/api/fastly/status', 'GET')">Fastly Status</button>
                    <h4>Platform Services</h4>
                    <button onclick="callEndpoint('/api/github/api', 'GET')">GitHub API</button>
                    <button onclick="callEndpoint('/api/github/cdn', 'GET')">GitHub CDN</button>
                    <button onclick="callEndpoint('/api/gitlab/api', 'GET')">GitLab API</button>
                    <button onclick="callEndpoint('/api/gitlab/cdn', 'GET')">GitLab CDN</button>
                    <h4>Hosting Services</h4>
                    <button onclick="callEndpoint('/api/vercel/api', 'GET')">Vercel API</button>
                    <button onclick="callEndpoint('/api/vercel/platform', 'GET')">Vercel Platform</button>
                    <button onclick="callEndpoint('/api/netlify/api', 'GET')">Netlify API</button>
                    <button onclick="callEndpoint('/api/netlify/cdn', 'GET')">Netlify CDN</button>
                    <button onclick="callEndpoint('/api/digitalocean/api', 'GET')">DigitalOcean API</button>
                    <button onclick="callEndpoint('/api/digitalocean/cdn', 'GET')">DigitalOcean CDN</button>
                    <div id="cloud-result" class="result" style="display:none;"></div>
                </div>

                <div class="api-section">
                    <h3>⚡ Batch Operations</h3>
                    <button onclick="runBatch()">Run Batch (5 calls)</button>
                    <button onclick="runBatch(10)">Run Batch (10 calls)</button>
                    <button onclick="runStressTest()">Stress Test (20 calls)</button>
                    <div id="batch-result" class="result" style="display:none;"></div>
                </div>

                <div style="margin-top: 20px;">
                    <button id="autoBtn" class="auto-mode" onclick="toggleAutoMode()">Start Auto Mode</button>
                    <button onclick="clearLogs()">Clear Logs</button>
                </div>
            </div>

            <div class="logs">
                <h2>Recent Activity</h2>
                <div id="activityLogs"></div>
            </div>
        </div>

        <script>
            let apiCount = 0;
            let autoMode = false;
            let autoInterval = null;

            function updateActivityLog(message) {
                const logs = document.getElementById('activityLogs');
                const entry = document.createElement('div');
                entry.className = 'log-entry';
                entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
                logs.insertBefore(entry, logs.firstChild);
                if (logs.children.length > 10) {
                    logs.removeChild(logs.lastChild);
                }
            }

            async function callAPI(category, endpoint) {
                updateActivityLog(`Calling ${category} API: ${endpoint}`);
                
                try {
                    const response = await fetch(`/api/${category}/${endpoint}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    apiCount++;
                    document.getElementById('apiCount').textContent = apiCount;
                    
                    const resultDiv = document.getElementById(`${category}-result`);
                    resultDiv.style.display = 'block';
                    resultDiv.textContent = JSON.stringify(data, null, 2);
                    
                    updateActivityLog(`✓ ${category}/${endpoint} - Status: ${response.status}`);
                } catch (error) {
                    updateActivityLog(`✗ Error calling ${category}/${endpoint}: ${error.message}`);
                }
            }

            async function callEndpoint(url, method = 'GET', body = null) {
                updateActivityLog(`Calling ${method} ${url}`);
                
                try {
                    const options = {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    };
                    
                    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                        options.body = JSON.stringify(body);
                    }
                    
                    const response = await fetch(url, options);
                    const data = await response.json();
                    apiCount++;
                    document.getElementById('apiCount').textContent = apiCount;
                    
                    // Show result in appropriate div
                    const resultDiv = document.getElementById(url.split('/')[2] + '-result') || 
                                     document.getElementById('quotes-result');
                    if (resultDiv) {
                        resultDiv.style.display = 'block';
                        resultDiv.textContent = JSON.stringify(data, null, 2);
                    }
                    
                    updateActivityLog(`✓ ${method} ${url} - Status: ${response.status}`);
                } catch (error) {
                    updateActivityLog(`✗ Error calling ${method} ${url}: ${error.message}`);
                }
            }

            async function runBatch(count = 5) {
                updateActivityLog(`Starting batch operation with ${count} calls`);
                try {
                    const response = await fetch('/api/batch', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            count: count,
                            endpoints: ['httpbin/get', 'quote/random', 'cat/fact', 'httpbin/post']
                        })
                    });
                    const data = await response.json();
                    apiCount += count;
                    document.getElementById('apiCount').textContent = apiCount;
                    
                    const resultDiv = document.getElementById('batch-result');
                    resultDiv.style.display = 'block';
                    resultDiv.textContent = JSON.stringify(data, null, 2);
                    updateActivityLog(`✓ Batch completed: ${data.batch_size} calls`);
                } catch (error) {
                    updateActivityLog(`✗ Batch operation failed: ${error.message}`);
                }
            }

            async function runStressTest() {
                updateActivityLog('Starting stress test (20 concurrent requests)');
                try {
                    const response = await fetch('/api/stress-test', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            requests: 20,
                            delay_ms: 50
                        })
                    });
                    const data = await response.json();
                    updateActivityLog(`✓ Stress test started: ${data.requests} requests`);
                    apiCount += data.requests;
                    document.getElementById('apiCount').textContent = apiCount;
                } catch (error) {
                    updateActivityLog(`✗ Stress test failed: ${error.message}`);
                }
            }

            function toggleAutoMode() {
                autoMode = !autoMode;
                const btn = document.getElementById('autoBtn');
                
                if (autoMode) {
                    btn.textContent = 'Stop Auto Mode';
                    btn.classList.add('active');
                    updateActivityLog('Auto mode started - making API calls every 3 seconds');
                    
                    autoInterval = setInterval(() => {
                        const actions = [
                            () => {
                                const categories = ['jsonplaceholder', 'poem', 'quotable'];
                                const endpoints = {
                                    'jsonplaceholder': ['posts', 'users', 'comments', 'albums'],
                                    'poem': ['random', 'author'],
                                    'quotable': []
                                };
                                const category = categories[Math.floor(Math.random() * categories.length)];
                                if (category === 'quotable') {
                                    callEndpoint('/api/quote/random', 'GET');
                                } else {
                                    const endpoint = endpoints[category][Math.floor(Math.random() * endpoints[category].length)];
                                    callAPI(category, endpoint);
                                }
                            },
                            () => callEndpoint('/api/httpbin/get', 'GET'),
                            () => callEndpoint('/api/httpbin/post', 'POST'),
                            () => callEndpoint('/api/cat/fact', 'GET'),
                            () => callEndpoint('/api/aws/s3', 'GET'),
                            () => callEndpoint('/api/aws/cloudfront', 'GET'),
                            () => callEndpoint('/api/cloudflare/cdn', 'GET'),
                            () => callEndpoint('/api/cloudflare/ips', 'GET'),
                            () => callEndpoint('/api/github/api', 'GET'),
                            () => callEndpoint('/api/github/cdn', 'GET'),
                            () => callEndpoint('/api/azure/status', 'GET'),
                            () => callEndpoint('/api/azure/cdn', 'GET'),
                            () => callEndpoint('/api/gcp/status', 'GET'),
                            () => callEndpoint('/api/gcp/storage', 'GET'),
                            () => callEndpoint('/api/fastly/cdn', 'GET'),
                            () => callEndpoint('/api/vercel/platform', 'GET'),
                            () => callEndpoint('/api/netlify/cdn', 'GET'),
                            () => callEndpoint('/api/digitalocean/cdn', 'GET'),
                            () => callEndpoint('/api/quote/random', 'GET'),
                            () => callEndpoint('/api/countries/usa', 'GET')
                        ];
                        const action = actions[Math.floor(Math.random() * actions.length)];
                        action();
                    }, 3000);
                } else {
                    btn.textContent = 'Start Auto Mode';
                    btn.classList.remove('active');
                    clearInterval(autoInterval);
                    updateActivityLog('Auto mode stopped');
                }
            }

            function clearLogs() {
                document.getElementById('activityLogs').innerHTML = '';
                updateActivityLog('Logs cleared');
            }

            // Initial status
            updateActivityLog('Application started and ready');
        </script>
    </body>
    </html>
    """
    return render_template_string(html, local_ip=LOCAL_IP)

@app.route('/api/jsonplaceholder/<endpoint>', methods=['GET'])
def jsonplaceholder_api_get(endpoint):
    """Call JSONPlaceholder API with GET."""
    if endpoint not in APIS['jsonplaceholder']:
        return jsonify({'error': 'Invalid endpoint'}), 404
    
    url = APIS['jsonplaceholder'][endpoint]
    response = call_api(url, method='GET')
    
    if response:
        data = response.json()
        return jsonify({
            'status': 'success',
            'data': data[:5] if isinstance(data, list) else data,  # Return first 5 items if list
            'count': len(data) if isinstance(data, list) else 1
        })
    else:
        return jsonify({'status': 'error', 'message': 'API call failed'}), 500

@app.route('/api/jsonplaceholder/posts/<int:post_id>', methods=['GET'])
def jsonplaceholder_post_by_id(post_id):
    """Get specific post by ID."""
    url = f"{APIS['jsonplaceholder']['posts']}/{post_id}"
    response = call_api(url, method='GET')
    if response:
        return jsonify({'status': 'success', 'data': response.json()})
    return jsonify({'status': 'error'}), 500

@app.route('/api/jsonplaceholder/posts', methods=['POST'])
def jsonplaceholder_create_post():
    """Create a new post."""
    url = APIS['jsonplaceholder']['posts']
    data = flask_request.get_json() or {
        'title': f'Test Post {random.randint(1, 1000)}',
        'body': 'This is a test post body content',
        'userId': random.randint(1, 10)
    }
    response = call_api(url, method='POST', params=data)
    if response:
        return jsonify({'status': 'success', 'data': response.json()})
    return jsonify({'status': 'error'}), 500

@app.route('/api/jsonplaceholder/posts/<int:post_id>', methods=['PUT'])
def jsonplaceholder_update_post(post_id):
    """Update a post."""
    url = f"{APIS['jsonplaceholder']['posts']}/{post_id}"
    data = flask_request.get_json() or {
        'id': post_id,
        'title': f'Updated Post {post_id}',
        'body': 'Updated content',
        'userId': random.randint(1, 10)
    }
    response = call_api(url, method='PUT', params=data)
    if response:
        return jsonify({'status': 'success', 'data': response.json()})
    return jsonify({'status': 'error'}), 500

@app.route('/api/jsonplaceholder/posts/<int:post_id>', methods=['DELETE'])
def jsonplaceholder_delete_post(post_id):
    """Delete a post."""
    url = f"{APIS['jsonplaceholder']['posts']}/{post_id}"
    response = call_api(url, method='DELETE')
    if response:
        return jsonify({'status': 'success', 'data': response.json()})
    return jsonify({'status': 'error'}), 500

@app.route('/api/poem/<endpoint>')
def poem_api(endpoint):
    """Call Poetry DB API."""
    if endpoint not in APIS['poem']:
        return jsonify({'error': 'Invalid endpoint'}), 404
    
    url = APIS['poem'][endpoint]
    response = call_api(url)
    
    if response:
        data = response.json()
        return jsonify({
            'status': 'success',
            'data': data[:3] if isinstance(data, list) else data
        })
    else:
        return jsonify({'status': 'error', 'message': 'API call failed'}), 500

@app.route('/api/weather/<endpoint>')
def weather_api(endpoint):
    """Call Weather API (will likely fail without API key, but logs the attempt)."""
    if endpoint not in APIS['weather']:
        return jsonify({'error': 'Invalid endpoint'}), 404
    
    # Weather API requires API key, so we'll log the attempt but it may fail
    url = f"{APIS['weather'][endpoint]}?q=London&appid=demo"
    response = call_api(url)
    
    if response:
        return jsonify({
            'status': 'success',
            'data': response.json()
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'Weather API requires API key. Traffic logged.'
        }), 500

# New API Endpoints with Different HTTP Methods

@app.route('/api/httpbin/get', methods=['GET'])
def httpbin_get():
    """Test GET requests via HTTPBin."""
    try:
        url = APIS['httpbin']['get']
        response = call_api(url, method='GET')
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'data': response.json()})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'success', 'data': {'response': response.text[:200]}})
        return jsonify({'status': 'error', 'message': f'HTTP {response.status_code if response else "No response"}'}), 500
    except Exception as e:
        logger.error(f"HTTPBin GET error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/httpbin/post', methods=['POST', 'GET'])
def httpbin_post():
    """Test POST requests via HTTPBin."""
    try:
        url = APIS['httpbin']['post']
        # Get JSON data, or form data, or create default
        if flask_request.is_json:
            data = flask_request.get_json()
        elif flask_request.form:
            data = dict(flask_request.form)
        else:
            data = {'test': 'data', 'timestamp': time.time(), 'method': 'POST'}
        response = call_api(url, method='POST', params=data)
        if response and response.status_code in [200, 201]:
            try:
                return jsonify({'status': 'success', 'data': response.json()})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'success', 'data': {'response': response.text[:200]}})
        return jsonify({'status': 'error', 'message': f'HTTP {response.status_code if response else "No response"}'}), 500
    except Exception as e:
        logger.error(f"HTTPBin POST error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/httpbin/put', methods=['PUT', 'POST'])
def httpbin_put():
    """Test PUT requests via HTTPBin."""
    try:
        url = APIS['httpbin']['put']
        if flask_request.is_json:
            data = flask_request.get_json()
        elif flask_request.form:
            data = dict(flask_request.form)
        else:
            data = {'action': 'update', 'id': random.randint(1, 100), 'timestamp': time.time()}
        response = call_api(url, method='PUT', params=data)
        if response and response.status_code in [200, 201]:
            try:
                return jsonify({'status': 'success', 'data': response.json()})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'success', 'data': {'response': response.text[:200]}})
        return jsonify({'status': 'error', 'message': f'HTTP {response.status_code if response else "No response"}'}), 500
    except Exception as e:
        logger.error(f"HTTPBin PUT error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/httpbin/delete', methods=['DELETE', 'GET'])
def httpbin_delete():
    """Test DELETE requests via HTTPBin."""
    try:
        url = APIS['httpbin']['delete']
        response = call_api(url, method='DELETE')
        if response and response.status_code in [200, 204]:
            try:
                return jsonify({'status': 'success', 'data': response.json()})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'success', 'data': {'message': 'Deleted successfully'}})
        return jsonify({'status': 'error', 'message': f'HTTP {response.status_code if response else "No response"}'}), 500
    except Exception as e:
        logger.error(f"HTTPBin DELETE error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/httpbin/patch', methods=['PATCH', 'POST'])
def httpbin_patch():
    """Test PATCH requests via HTTPBin."""
    try:
        url = APIS['httpbin']['patch']
        if flask_request.is_json:
            data = flask_request.get_json()
        elif flask_request.form:
            data = dict(flask_request.form)
        else:
            data = {'action': 'patch', 'changes': random.randint(1, 50), 'timestamp': time.time()}
        response = call_api(url, method='PATCH', params=data)
        if response and response.status_code in [200, 201]:
            try:
                return jsonify({'status': 'success', 'data': response.json()})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'success', 'data': {'response': response.text[:200]}})
        return jsonify({'status': 'error', 'message': f'HTTP {response.status_code if response else "No response"}'}), 500
    except Exception as e:
        logger.error(f"HTTPBin PATCH error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/httpbin/delay/<int:seconds>', methods=['GET'])
def httpbin_delay(seconds):
    """Test delayed responses via HTTPBin."""
    try:
        delay = min(seconds, 10)  # Max 10 seconds
        url = f"{APIS['httpbin']['delay']}/{delay}"
        response = call_api(url, method='GET', timeout=delay + 5)  # Add extra timeout for delay
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'data': response.json()})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'success', 'data': {'response': response.text[:200], 'delay': delay}})
        return jsonify({'status': 'error', 'message': f'HTTP {response.status_code if response else "No response"}'}), 500
    except Exception as e:
        logger.error(f"HTTPBin delay error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/countries/all', methods=['GET'])
def countries_all():
    """Get all countries via REST Countries API."""
    try:
        url = APIS['restcountries']['all']
        response = call_api(url)
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'count': len(data), 'data': data[:10]})  # Return first 10
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'error', 'message': 'Invalid JSON response'}), 500
        return jsonify({'status': 'error', 'message': 'API call failed'}), 500
    except Exception as e:
        logger.error(f"Countries API error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/countries/<country>', methods=['GET'])
def countries_by_name(country):
    """Get country by name."""
    try:
        url = f"{APIS['restcountries']['name']}/{country}"
        response = call_api(url)
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'data': data})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'error', 'message': 'Invalid JSON response'}), 500
        return jsonify({'status': 'error', 'message': 'Country not found or API unavailable'}), 500
    except Exception as e:
        logger.error(f"Country API error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/quote/random', methods=['GET'])
def quote_random():
    """Get random quote."""
    try:
        url = APIS['quotable']['random']
        response = call_api(url, method='GET')
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'data': data})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'error', 'message': 'Invalid JSON response'}), 500
        # If quotable fails, use a fallback or return error gracefully
        return jsonify({
            'status': 'success',
            'data': {
                'content': 'The only way to do great work is to love what you do.',
                'author': 'Steve Jobs'
            },
            'note': 'Using fallback quote (API unavailable)'
        })
    except Exception as e:
        logger.error(f"Quote API error: {str(e)}")
        return jsonify({
            'status': 'success',
            'data': {
                'content': 'The only way to do great work is to love what you do.',
                'author': 'Steve Jobs'
            },
            'note': 'Using fallback quote (API unavailable)'
        })

@app.route('/api/cat/fact', methods=['GET'])
def cat_fact():
    """Get random cat fact."""
    try:
        url = APIS['catfacts']['facts']
        response = call_api(url, method='GET')
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'data': data})
            except (ValueError, json.JSONDecodeError):
                # Some APIs return plain text instead of JSON
                text_content = response.text.strip()
                if text_content:
                    return jsonify({'status': 'success', 'data': {'fact': text_content}})
                return jsonify({'status': 'error', 'message': 'Empty response'}), 500
        return jsonify({'status': 'error', 'message': 'API call failed'}), 500
    except Exception as e:
        logger.error(f"Cat fact API error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/dog/random', methods=['GET'])
def dog_random():
    """Get random dog image."""
    try:
        url = APIS['dogapi']['random']
        response = call_api(url, method='GET')
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'data': data})
            except (ValueError, json.JSONDecodeError):
                return jsonify({'status': 'error', 'message': 'Invalid JSON response'}), 500
        return jsonify({'status': 'error', 'message': 'API call failed'}), 500
    except Exception as e:
        logger.error(f"Dog API error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/ip/info', methods=['GET'])
def ip_info():
    """Get IP information."""
    try:
        url = APIS['ipapi']['ip']
        response = call_api(url, method='GET')
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'data': data})
            except (ValueError, json.JSONDecodeError):
                # Try alternative IP API
                try:
                    alt_url = APIS['ipapi']['ipv4']
                    alt_response = call_api(alt_url, method='GET')
                    if alt_response and alt_response.status_code == 200:
                        return jsonify({'status': 'success', 'data': alt_response.json()})
                except:
                    pass
                return jsonify({'status': 'error', 'message': 'Invalid JSON response'}), 500
        return jsonify({'status': 'error', 'message': 'API call failed'}), 500
    except Exception as e:
        logger.error(f"IP info API error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/batch', methods=['POST'])
def batch_operations():
    """Execute batch API calls for generating more traffic."""
    data = flask_request.get_json() or {}
    count = min(data.get('count', 5), 20)  # Max 20 calls
    endpoints = data.get('endpoints', ['httpbin/get', 'quote/random', 'cat/fact'])
    
    results = []
    for i in range(count):
        endpoint = random.choice(endpoints)
        try:
            if endpoint == 'httpbin/get':
                url = APIS['httpbin']['get']
                response = call_api(url, method='GET')
            elif endpoint == 'httpbin/post':
                url = APIS['httpbin']['post']
                response = call_api(url, method='POST', params={'batch': i, 'timestamp': time.time()})
            elif endpoint == 'quote/random':
                url = APIS['quotable']['random']
                response = call_api(url, method='GET')
            elif endpoint == 'cat/fact':
                url = APIS['catfacts']['facts']
                response = call_api(url, method='GET')
            else:
                continue
            results.append({'endpoint': endpoint, 'status': 'success'})
        except Exception as e:
            results.append({'endpoint': endpoint, 'status': 'error', 'message': str(e)})
    
    return jsonify({'status': 'success', 'batch_size': count, 'results': results})

@app.route('/api/stress-test', methods=['POST'])
def stress_test():
    """Generate high volume of API calls for stress testing."""
    data = flask_request.get_json() or {}
    requests_count = min(data.get('requests', 10), 50)  # Max 50 requests
    delay = data.get('delay_ms', 100) / 1000.0  # Delay between requests in seconds
    
    import threading
    
    def make_request(idx):
        time.sleep(idx * delay)
        urls = [
            APIS['httpbin']['get'],
            APIS['quotable']['random'],
            APIS['catfacts']['facts'],
            APIS['jsonplaceholder']['posts'] + f'/{random.randint(1, 100)}'
        ]
        url = random.choice(urls)
        call_api(url, method='GET')
    
    threads = []
    for i in range(requests_count):
        t = threading.Thread(target=make_request, args=(i,))
        threads.append(t)
        t.start()
    
    return jsonify({
        'status': 'success',
        'message': f'Started {requests_count} concurrent requests',
        'requests': requests_count,
        'delay_ms': delay * 1000
    })

@app.route('/api/stats')
def stats():
    """Get application statistics."""
    try:
        # Count log entries
        try:
            with open(NETWORK_LOG_FILE, 'r') as f:
                log_count = sum(1 for line in f)
        except:
            log_count = 0
        
        return jsonify({
            'network_logs': log_count,
            'local_ip': LOCAL_IP,
            'status': 'running'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Cloud Services API Endpoints - Real cloud service calls
@app.route('/api/aws/s3', methods=['GET'])
def aws_s3():
    """Call real AWS S3 endpoint."""
    try:
        url = APIS['aws']['s3_bucket']
        response = call_api(url, method='GET', timeout=10)
        return jsonify({
            'status': 'success', 
            'service': 'AWS S3',
            'data': {'message': 'S3 endpoint called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"AWS S3 call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'AWS S3', 'message': str(e)}), 500

@app.route('/api/aws/cloudfront', methods=['GET'])
def aws_cloudfront():
    """Call real AWS CloudFront CDN."""
    try:
        url = APIS['aws']['cloudfront']
        response = call_api(url, method='GET', timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'AWS CloudFront',
            'data': {'message': 'CloudFront CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"AWS CloudFront call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'AWS CloudFront', 'message': str(e)}), 500

@app.route('/api/aws/status', methods=['GET'])
def aws_status():
    """Call real AWS status API."""
    try:
        url = APIS['aws']['status']
        response = call_api(url, timeout=10)
        if response and response.status_code == 200:
            try:
                data = response.json()
                return jsonify({'status': 'success', 'service': 'AWS Status', 'data': data})
            except:
                return jsonify({'status': 'success', 'service': 'AWS Status', 'data': {'message': 'Status API called'}})
        return jsonify({'status': 'error', 'message': 'AWS status check failed'}), 500
    except Exception as e:
        logger.debug(f"AWS status check failed: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/azure/status', methods=['GET'])
def azure_status():
    """Call real Azure status API."""
    try:
        url = APIS['azure']['status']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success', 
            'service': 'Azure',
            'data': {'message': 'Azure status API called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"Azure status check failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Azure', 'message': str(e)}), 500

@app.route('/api/azure/cdn', methods=['GET'])
def azure_cdn():
    """Call real Azure CDN."""
    try:
        url = APIS['azure']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'Azure CDN',
            'data': {'message': 'Azure CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"Azure CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Azure CDN', 'message': str(e)}), 500

@app.route('/api/gcp/status', methods=['GET'])
def gcp_status():
    """Call real Google Cloud Platform status API."""
    try:
        url = APIS['gcp']['status']
        response = call_api(url, timeout=10)
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'service': 'GCP', 'data': response.json()})
            except:
                return jsonify({'status': 'success', 'service': 'GCP', 'data': {'message': 'GCP status API called'}})
        return jsonify({'status': 'error', 'message': 'GCP status check failed'}), 500
    except Exception as e:
        logger.debug(f"GCP status check failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'GCP', 'message': str(e)}), 500

@app.route('/api/gcp/storage', methods=['GET'])
def gcp_storage():
    """Call real Google Cloud Storage endpoint."""
    try:
        url = APIS['gcp']['storage']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'GCP Storage',
            'data': {'message': 'GCP Storage called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"GCP Storage call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'GCP Storage', 'message': str(e)}), 500

@app.route('/api/cloudflare/cdn', methods=['GET'])
def cloudflare_cdn():
    """Call real Cloudflare CDN (many sites use Cloudflare)."""
    try:
        url = APIS['cloudflare']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'Cloudflare CDN',
            'data': {'message': 'Cloudflare CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"Cloudflare CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Cloudflare CDN', 'message': str(e)}), 500

@app.route('/api/cloudflare/ips', methods=['GET'])
def cloudflare_ips():
    """Call real Cloudflare IP ranges API."""
    try:
        url = APIS['cloudflare']['api']
        response = call_api(url, timeout=10, headers={'Content-Type': 'application/json'})
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'service': 'Cloudflare', 'data': response.json()})
            except:
                return jsonify({'status': 'success', 'service': 'Cloudflare', 'data': {'message': 'Cloudflare API called'}})
        return jsonify({'status': 'error', 'message': 'Cloudflare API failed'}), 500
    except Exception as e:
        logger.debug(f"Cloudflare API call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Cloudflare', 'message': str(e)}), 500

@app.route('/api/cloudflare/status', methods=['GET'])
def cloudflare_status():
    """Call real Cloudflare status API."""
    try:
        url = APIS['cloudflare']['status']
        response = call_api(url, timeout=10)
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'service': 'Cloudflare Status', 'data': response.json()})
            except:
                return jsonify({'status': 'success', 'service': 'Cloudflare Status', 'data': {'message': 'Status API called'}})
        return jsonify({'status': 'error', 'message': 'Cloudflare status failed'}), 500
    except Exception as e:
        logger.debug(f"Cloudflare status failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Cloudflare', 'message': str(e)}), 500

@app.route('/api/fastly/cdn', methods=['GET'])
def fastly_cdn():
    """Call real Fastly CDN."""
    try:
        url = APIS['fastly']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'Fastly CDN',
            'data': {'message': 'Fastly CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"Fastly CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Fastly CDN', 'message': str(e)}), 500

@app.route('/api/fastly/status', methods=['GET'])
def fastly_status():
    """Call real Fastly status API."""
    try:
        url = APIS['fastly']['status']
        response = call_api(url, timeout=10)
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'service': 'Fastly', 'data': response.json()})
            except:
                return jsonify({'status': 'success', 'service': 'Fastly', 'data': {'message': 'Fastly status API called'}})
        return jsonify({'status': 'error', 'message': 'Fastly status failed'}), 500
    except Exception as e:
        logger.debug(f"Fastly status failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Fastly', 'message': str(e)}), 500

@app.route('/api/github/api', methods=['GET'])
def github_api():
    """Call real GitHub API (public endpoints)."""
    try:
        url = f"{APIS['github']['api']}/zen"
        response = call_api(url, timeout=10)
        if response and response.status_code == 200:
            return jsonify({
                'status': 'success', 
                'service': 'GitHub',
                'data': {'message': response.text.strip() if response.text else 'GitHub API called', 'status_code': response.status_code}
            })
        return jsonify({'status': 'error', 'message': 'GitHub API failed'}), 500
    except Exception as e:
        logger.debug(f"GitHub API failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'GitHub', 'message': str(e)}), 500

@app.route('/api/github/cdn', methods=['GET'])
def github_cdn():
    """Call real GitHub CDN."""
    try:
        url = APIS['github']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'GitHub CDN',
            'data': {'message': 'GitHub CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"GitHub CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'GitHub CDN', 'message': str(e)}), 500

@app.route('/api/gitlab/api', methods=['GET'])
def gitlab_api():
    """Call real GitLab API (public endpoints)."""
    try:
        url = f"{APIS['gitlab']['api']}/version"
        response = call_api(url, timeout=10)
        if response and response.status_code == 200:
            try:
                return jsonify({'status': 'success', 'service': 'GitLab', 'data': response.json()})
            except:
                return jsonify({'status': 'success', 'service': 'GitLab', 'data': {'message': 'GitLab API called'}})
        return jsonify({'status': 'error', 'message': 'GitLab API failed'}), 500
    except Exception as e:
        logger.debug(f"GitLab API failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'GitLab', 'message': str(e)}), 500

@app.route('/api/gitlab/cdn', methods=['GET'])
def gitlab_cdn():
    """Call real GitLab CDN."""
    try:
        url = APIS['gitlab']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'GitLab CDN',
            'data': {'message': 'GitLab CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"GitLab CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'GitLab CDN', 'message': str(e)}), 500

@app.route('/api/digitalocean/api', methods=['GET'])
def digitalocean_api():
    """Call real DigitalOcean API."""
    try:
        url = f"{APIS['digitalocean']['api']}/sizes"
        response = call_api(url, timeout=10, headers={'Content-Type': 'application/json'})
        if response:
            return jsonify({
                'status': 'success', 
                'service': 'DigitalOcean',
                'data': {'message': 'DigitalOcean API called', 'status_code': response.status_code}
            })
        return jsonify({'status': 'error', 'message': 'DigitalOcean API failed'}), 500
    except Exception as e:
        logger.debug(f"DigitalOcean API failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'DigitalOcean', 'message': str(e)}), 500

@app.route('/api/digitalocean/cdn', methods=['GET'])
def digitalocean_cdn():
    """Call real DigitalOcean CDN."""
    try:
        url = APIS['digitalocean']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'DigitalOcean CDN',
            'data': {'message': 'DigitalOcean CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"DigitalOcean CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'DigitalOcean CDN', 'message': str(e)}), 500

@app.route('/api/vercel/api', methods=['GET'])
def vercel_api():
    """Call real Vercel API."""
    try:
        url = f"{APIS['vercel']['api']}/v1"
        response = call_api(url, timeout=10)
        if response:
            return jsonify({
                'status': 'success', 
                'service': 'Vercel',
                'data': {'message': 'Vercel API called', 'status_code': response.status_code}
            })
        return jsonify({'status': 'error', 'message': 'Vercel API failed'}), 500
    except Exception as e:
        logger.debug(f"Vercel API failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Vercel', 'message': str(e)}), 500

@app.route('/api/vercel/platform', methods=['GET'])
def vercel_platform():
    """Call real Vercel platform."""
    try:
        url = APIS['vercel']['platform']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'Vercel Platform',
            'data': {'message': 'Vercel platform called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"Vercel platform call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Vercel Platform', 'message': str(e)}), 500

@app.route('/api/netlify/api', methods=['GET'])
def netlify_api():
    """Call real Netlify API."""
    try:
        url = f"{APIS['netlify']['api']}/sites"
        response = call_api(url, timeout=10)
        if response:
            return jsonify({
                'status': 'success', 
                'service': 'Netlify',
                'data': {'message': 'Netlify API called', 'status_code': response.status_code}
            })
        return jsonify({'status': 'error', 'message': 'Netlify API failed'}), 500
    except Exception as e:
        logger.debug(f"Netlify API failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Netlify', 'message': str(e)}), 500

@app.route('/api/netlify/cdn', methods=['GET'])
def netlify_cdn():
    """Call real Netlify CDN."""
    try:
        url = APIS['netlify']['cdn']
        response = call_api(url, timeout=10)
        return jsonify({
            'status': 'success',
            'service': 'Netlify CDN',
            'data': {'message': 'Netlify CDN called', 'status_code': response.status_code if response else 'N/A'}
        })
    except Exception as e:
        logger.debug(f"Netlify CDN call failed: {str(e)}")
        return jsonify({'status': 'error', 'service': 'Netlify CDN', 'message': str(e)}), 500

# Background thread to generate periodic traffic
background_traffic = False
traffic_thread = None

def generate_background_traffic():
    """Generate background network traffic."""
    while background_traffic:
        try:
            # Random API calls
            apis_to_call = [
                ('jsonplaceholder', 'posts'),
                ('jsonplaceholder', 'users'),
                ('poem', 'random'),
            ]
            
            category, endpoint = random.choice(apis_to_call)
            url = APIS[category][endpoint]
            
            call_api(url)
            time.sleep(random.randint(5, 15))  # Wait 5-15 seconds
        except Exception as e:
            logger.error(f"Background traffic generation error: {str(e)}")
            time.sleep(10)

if __name__ == '__main__':
    logger.info("Starting Real Network Traffic Generator")
    logger.info(f"Server will run on http://0.0.0.0:9000")
    
    # Start background traffic generation
    background_traffic = True
    traffic_thread = threading.Thread(target=generate_background_traffic, daemon=True)
    traffic_thread.start()
    logger.info("Background traffic generation started")
    
    # Run Flask app
    app.run(host='0.0.0.0', port=9000, debug=False, threaded=True)
