# Load Testing with Locust

This guide explains how to perform load testing on ubyssey.ca using Locust.

## What is Locust?

Locust is a scalable load testing tool that simulates users browsing your website. It helps you:
- Test how your site performs under heavy traffic
- Identify bottlenecks and performance issues
- Measure response times and throughput
- Simulate realistic user behavior
- Real-time visualization with built-in web UI

## Quick Start

### Option 1: Using Docker (Recommended - Simplest)

**Start Locust with web UI:**
```bash
docker-compose -f docker-compose.locust.yml up
```

Then open http://localhost:8089 in your browser to access the Locust web interface.

**The Web UI shows:**
- Real-time charts (RPS, response times, user count)
- Statistics table (requests, failures, response times)
- Download results as CSV
- Live failure logs

**Configure the test:**
1. Number of users: Start with 50-100
2. Spawn rate: 5-10 users/second
3. Host: Pre-configured for staging.ubyssey.ca
4. Click "Start swarming"
5. Watch the real-time charts!

**Stop the test:**
```bash
docker-compose -f docker-compose.locust.yml down
```

### Option 2: Install Locally

**Install Locust:**
```bash
pip install -r locust-requirements.txt
```

**Run against staging:**
```bash
locust --host=https://staging.ubyssey.ca
```

**Run against production (be careful!):**
```bash
locust --host=https://ubyssey.ca
```

Then open http://localhost:8089

### Option 3: Headless Mode (No Web UI)

Run a test directly from the command line:

```bash
# Docker
docker run --rm -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 \
  -f /home/locust/locustfile.py \
  --host=https://staging.ubyssey.ca \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --headless

# Local installation
locust --host=https://staging.ubyssey.ca --users 100 --spawn-rate 10 --run-time 5m --headless
```

## User Types

The load test simulates three types of users:

### 1. UbysseyUser (Regular readers)
- Views homepage
- Browses sections (news, culture, sports, etc.)
- Reads articles
- Uses search
- Views authors and archives
- Simulates 1-5 second reading time between actions

### 2. MobileUser (Mobile readers)
- Quick browsing patterns
- Often lands directly on articles (from social media)
- Fewer pages per session
- 2-6 second wait times

### 3. BotUser (Crawlers)
- Simulates search engine bots
- Crawls homepage, sitemap, robots.txt
- Faster crawling (0.5-2 seconds between requests)

## Test Scenarios

### Light Load Test (Normal Traffic)
```bash
locust --host=https://staging.ubyssey.ca --users 50 --spawn-rate 5 --run-time 10m
```
Simulates normal daily traffic.

### Medium Load Test (Peak Hours)
```bash
locust --host=https://staging.ubyssey.ca --users 200 --spawn-rate 10 --run-time 15m
```
Simulates peak traffic (article publish, breaking news).

### Heavy Load Test (Stress Test)
```bash
locust --host=https://staging.ubyssey.ca --users 500 --spawn-rate 20 --run-time 10m
```
Tests system limits and identifies breaking points.

### Spike Test (Sudden Traffic)
```bash
locust --host=https://staging.ubyssey.ca --users 1000 --spawn-rate 50 --run-time 5m
```
Simulates sudden viral traffic (Reddit front page, Twitter viral post).

## Understanding Results

### Key Metrics

**Response Time:**
- < 200ms: Excellent
- 200-500ms: Good
- 500ms-1s: Acceptable
- 1-3s: Slow
- > 3s: Poor

**Requests per Second (RPS):**
- Shows throughput capacity
- Compare against expected traffic

**Failure Rate:**
- Should be < 1% under normal load
- Check logs for 500 errors, timeouts

**Percentiles:**
- p50 (median): Typical user experience
- p95: 95% of users experience this or better
- p99: Worst-case for most users

## Best Practices

### Testing Staging
✅ **Safe to test aggressively**
- Test high loads to find limits
- Experiment with different scenarios
- Test before deploying to production

### Testing Production
⚠️ **Be careful!**
- Start with low user counts (10-50)
- Gradually increase load
- Monitor server resources (CPU, memory, DB connections)
- Have someone watching logs/metrics
- Run during low-traffic hours
- Don't run spike tests on production without planning

### What to Monitor During Tests

**Application:**
- Django response times
- Database query times
- Cache hit rates

**Infrastructure:**
- CPU usage
- Memory usage
- Network bandwidth
- Nginx connection count
- Database connections

**Docker Swarm:**
```bash
# Watch container stats
docker stats

# Check service status
docker service ls

# View logs
docker service logs ubyssey_django --tail 100 --follow
```

**System resources:**
```bash
# CPU and memory
htop

# Network
iftop
```

## Customizing Tests

Edit [locustfile.py](locustfile.py) to:
- Add new user behaviors
- Test specific endpoints
- Simulate different traffic patterns
- Add authentication flows
- Test API endpoints

Example - Add a new task:
```python
@task(2)
def view_videos(self):
    """View videos section"""
    self.client.get("/videos/")
```

## Troubleshooting

**High failure rate:**
- Check Django logs: `docker service logs ubyssey_django`
- Check nginx logs: `docker service logs ubyssey_nginx`
- Verify health checks are passing: `docker ps`

**Slow response times:**
- Check database performance
- Review cache hit rates
- Profile slow queries
- Check if any containers are restarting

**Connection errors:**
- Verify target host is accessible
- Check firewall rules
- Verify SSL certificates are valid

## Advanced Usage

### Distributed Load Testing

Run Locust across multiple machines for very high load:

**Master node:**
```bash
locust --master --host=https://staging.ubyssey.ca
```

**Worker nodes:**
```bash
locust --worker --master-host=<master-ip>
```

### Exporting Results

Save test results to file:
```bash
locust --host=https://staging.ubyssey.ca \
  --users 100 --spawn-rate 10 --run-time 10m \
  --headless \
  --html report.html \
  --csv results
```

This generates:
- `report.html` - Visual report
- `results_stats.csv` - Statistics
- `results_failures.csv` - Failed requests
- `results_stats_history.csv` - Time series data

## Safety Checklist

Before running production load tests:

- [ ] Tested on staging first
- [ ] Team is aware and monitoring
- [ ] Running during low-traffic hours
- [ ] Starting with low user count
- [ ] Monitoring tools are ready
- [ ] Have rollback plan if issues occur
- [ ] Database backups are current

## Resources

- [Locust Documentation](https://docs.locust.io/)
- [Writing Locustfiles](https://docs.locust.io/en/stable/writing-a-locustfile.html)
- [Distributed Testing](https://docs.locust.io/en/stable/running-distributed.html)
