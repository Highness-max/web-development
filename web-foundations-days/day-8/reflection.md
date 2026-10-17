**What was the most difficult concept in the course, and how did you
overcome it?**

The hardest concept was asynchronous JavaScript — specifically, why
`fetch()` needs two `await`s (`await fetch(...)` and then
`await response.json()`) and why logging the raw return value shows
`Promise {<pending>}` instead of the data. I overcame it by drawing the
request lifecycle on paper and watching the DevTools Network tab every
time I ran a request: the "pending" state turning to "200", then the
response body arriving as separate frames. Once I saw that "response
headers arrive before the body" with my own eyes, `await` stopped being
magic and became obvious: the first `await` waits for the headers, the
second waits for the body to finish arriving.

**Which part of your capstone would you improve, based on the feedback
you received?**

The architecture document. My peer reviewers said the diagram was
complete but the trade-offs were too shallow — I named them but did not
say what I was giving up. If I revised it, I would add a "what breaks
first" paragraph for each trade-off (for example, "if the cache TTL is
too short, every hold triggers a database hit and the primary becomes
the bottleneck"), and I would show the load estimate mapped directly
onto each component.

**What will you learn next?**

I want to build a real backend with Node.js and Express so my API
design document becomes working code, and then learn React to build
the front end properly. After that, I want to go deeper into databases
— specifically transactions and isolation levels — because writing the
double-booking section made me realise how much of the correctness of
a real system lives in the database, not the application.
