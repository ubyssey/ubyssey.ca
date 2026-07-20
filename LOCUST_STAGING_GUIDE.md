# Running Locust on Staging VM

This guide shows how to run load tests from the staging VM itself.

## Files Location

After deployment, Locust files are located at:
```
/opt/ubyssey.ca/locust/
├── locustfile.py
├── docker-compose.locust.yml
├── locust-requirements.txt
└── README.md
```

## Running Load Tests on Staging VM

### Quick Start

**1. SSH into staging VM:**
```bash
ssh staging
```

**2. Navigate to locust directory:**
```bash
cd /opt/ubyssey.ca/locust
```

**3. Start Locust:**
```bash
docker-compose -f docker-compose.locust.yml up -d
```

**4. Access Locust UI:**

Since Locust is running on the VM, you need to access it through SSH tunnel:

**From your local machine:**
```bash
ssh -L 8089:localhost:8089 staging
```

Then open http://localhost:8089 in your browser.

**5. Configure and run test:**
- Number of users: 50-100
- Spawn rate: 5-10
- Host: Already set to https://staging.ubyssey.ca
- Click "Start swarming"

**6. Stop Locust when done:**
```bash
# On staging VM
cd /opt/ubyssey.ca/locust
docker-compose -f docker-compose.locust.yml down
```

## Headless Testing (No Web UI)

Run tests directly from command line:

```bash
cd /opt/ubyssey.ca/locust

docker run --rm \
  -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 \
  -f /home/locust/locustfile.py \
  --host=https://staging.ubyssey.ca \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --headless
```

## Test Scenarios

### Light Load (Normal Traffic)
```bash
docker run --rm -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 -f /home/locust/locustfile.py \
  --host=https://staging.ubyssey.ca \
  --users 50 --spawn-rate 5 --run-time 10m --headless
```

### Medium Load (Peak Hours)
```bash
docker run --rm -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 -f /home/locust/locustfile.py \
  --host=https://staging.ubyssey.ca \
  --users 200 --spawn-rate 10 --run-time 15m --headless
```

### Heavy Load (Stress Test)
```bash
docker run --rm -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 -f /home/locust/locustfile.py \
  --host=https://staging.ubyssey.ca \
  --users 500 --spawn-rate 20 --run-time 10m --headless
```

## Monitoring During Tests

While tests are running, monitor the application:

**1. Check container stats:**
```bash
docker stats
```

**2. Watch Django logs:**
```bash
docker service logs ubyssey_django --tail 100 --follow
```

**3. Watch nginx logs:**
```bash
docker service logs ubyssey_nginx --tail 100 --follow
```

**4. Check service health:**
```bash
docker service ls
```

**5. System resources:**
```bash
# CPU and memory
top

# Network connections
netstat -an | grep :80 | wc -l
```

## Generating Reports

Save test results to HTML report:

```bash
cd /opt/ubyssey.ca/locust

docker run --rm \
  -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  -v $(pwd)/reports:/home/locust/reports \
  locustio/locust:2.32.4 \
  -f /home/locust/locustfile.py \
  --host=https://staging.ubyssey.ca \
  --users 100 --spawn-rate 10 --run-time 5m \
  --headless \
  --html /home/locust/reports/report.html \
  --csv /home/locust/reports/results
```

Then download the report to your local machine:
```bash
# From local machine
scp staging:/opt/ubyssey.ca/locust/reports/report.html ./locust-report.html
```

## Tips

**Testing from VM vs Local:**
- ✅ **From VM**: No network latency, consistent bandwidth, won't affect your local machine
- ❌ **From Local**: Includes your internet latency, limited by your bandwidth

**Safety:**
- Staging is safe to stress test
- Start with low users and gradually increase
- Watch for error rates > 1%
- Monitor CPU/memory usage

**When to run:**
- Anytime on staging
- Before major releases
- After infrastructure changes
- To establish performance baselines

## Troubleshooting

**Locust container won't start:**
```bash
# Check if port 8089 is in use
netstat -tulpn | grep 8089

# Check logs
docker-compose -f docker-compose.locust.yml logs
```

**High failure rates:**
```bash
# Check application logs
docker service logs ubyssey_django --tail 100

# Check if containers are healthy
docker ps
```

**Can't access web UI:**
- Make sure SSH tunnel is active: `ssh -L 8089:localhost:8089 staging`
- Check Locust is running: `docker ps | grep locust`

## Advanced: Load Test from Multiple VMs

For extreme load testing, you can run Locust in distributed mode across multiple machines:

**On first VM (master):**
```bash
docker run --rm -p 8089:8089 -p 5557:5557 \
  -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 \
  -f /home/locust/locustfile.py \
  --master \
  --host=https://staging.ubyssey.ca
```

**On other VMs (workers):**
```bash
docker run --rm \
  -v $(pwd)/locustfile.py:/home/locust/locustfile.py \
  locustio/locust:2.32.4 \
  -f /home/locust/locustfile.py \
  --worker \
  --master-host=<master-vm-ip>
```
