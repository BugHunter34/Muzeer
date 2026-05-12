useEffect(() => {
  if (!initialQuery.trim()) {
    setResult(null);
    setError("");
    return;
  }

  const fetchResult = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${MEDIA_API_BASE_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: initialQuery,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResult(Array.isArray(data) ? data[0] : data);
    } catch (err) {
      setResult(null);
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  fetchResult();
}, [initialQuery]);
