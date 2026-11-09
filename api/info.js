// Vercel serverless function: looks up channel names, pictures and live status.
// The API key lives in the YT_KEY environment variable, never in the repo.
module.exports = async (req, res) => {
    const key = process.env.YT_KEY;
    const ids = String(req.query.ids || "")
        .split(",")
        .filter(id => /^[\w-]{11}$/.test(id))      // only real video IDs
        .slice(0, 50);

    if (!key || !ids.length) return res.status(200).json({});

    const base = "https://www.googleapis.com/youtube/v3";
    try {
        const v = await (await fetch(
            `${base}/videos?part=snippet,liveStreamingDetails&id=${ids.join(",")}&key=${key}`
        )).json();
        const items = v.items || [];
        if (!items.length) return res.status(200).json({});

        const chIds = [...new Set(items.map(i => i.snippet.channelId))];
        const c = await (await fetch(
            `${base}/channels?part=snippet&id=${chIds.join(",")}&key=${key}`
        )).json();

        const pics = {};
        (c.items || []).forEach(ch => { pics[ch.id] = ch.snippet.thumbnails.default.url; });

        const out = {};
        items.forEach(i => {
            const d = i.liveStreamingDetails;
            out[i.id] = {
                channel: i.snippet.channelTitle,
                avatar: pics[i.snippet.channelId],
                live: !!(d && d.actualStartTime && !d.actualEndTime),
            };
        });

        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
        res.status(200).json(out);
    } catch (e) {
        res.status(200).json({});
    }
};