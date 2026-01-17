import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const PAGE_SIZES = {
  favorites: 5,
  logs: 5,
  search: 6,
};

const chartAccent = ["peach", "mint", "sky", "butter", "rose"];

export default function App() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSource, setSearchSource] = useState("netease");
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAllCharts, setShowAllCharts] = useState(false);
  const [charts, setCharts] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState("");
  const [activeChart, setActiveChart] = useState(null);
  const [chartSongs, setChartSongs] = useState([]);
  const [chartSongsLoading, setChartSongsLoading] = useState(false);
  const [chartSongsError, setChartSongsError] = useState("");
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState("");
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [playQueue, setPlayQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playMode, setPlayMode] = useState("order");
  const [playHistory, setPlayHistory] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState({
    nickname: "",
    signature: "",
    avatar_url: "",
  });
  const [logs, setLogs] = useState([]);
  const [profileStatus, setProfileStatus] = useState("");
  const [activeLog, setActiveLog] = useState(null);
  const [favoritePage, setFavoritePage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordStatus, setPasswordStatus] = useState("");
  const [deleteForm, setDeleteForm] = useState({ password: "" });
  const [deleteStatus, setDeleteStatus] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    type: null,
  });
  const [showIntro, setShowIntro] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const lyricsCanvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const peakRef = useRef([]);
  const lyricsBoxRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const cachedUser = localStorage.getItem("auth_user");
    if (cachedUser) {
      setCurrentUser(cachedUser);
    }
    if (!token) return;
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.username) {
          setCurrentUser(data.data.username);
          localStorage.setItem("auth_user", data.data.username);
          fetchFavorites(token);
          fetchProfile(token);
          fetchLogs(token);
        } else {
          setCurrentUser("");
          localStorage.removeItem("auth_user");
          localStorage.removeItem("auth_token");
        }
      })
      .catch(() => {});
  }, []);

  const fetchFavorites = async (token) => {
    if (!token) return;
    setFavoritesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.code !== 200) {
        setFavorites([]);
        return;
      }
      setFavorites(data?.data?.list || []);
      setFavoritePage(1);
    } catch (error) {
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const fetchProfile = async (token) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.code !== 200) return;
      setProfile({
        nickname: data?.data?.nickname || "",
        signature: data?.data?.signature || "",
        avatar_url: data?.data?.avatar_url || "",
      });
    } catch (error) {
      // ignore
    }
  };

  const fetchLogs = async (token) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/login-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data?.code !== 200) return;
      setLogs(data?.data?.list || []);
      setLogPage(1);
    } catch (error) {
      // ignore
    }
  };

  const runSearch = async (event) => {
    event.preventDefault();
    const keyword = searchKeyword.trim();
    if (!keyword) return;
    setSearchLoading(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({
        type: "search",
        keyword,
        source: searchSource,
        limit: "50",
      });
      const res = await fetch(`${API_BASE}/api/?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data?.code !== 200) {
        setSearchError(data?.message || "搜索失败");
        setSearchResults([]);
        return;
      }
      setSearchResults(data?.data?.results || []);
      setSearchPage(1);
    } catch (error) {
      setSearchError("网络错误");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setStatus("");
    const endpoint = mode === "login" ? "login" : "register";
    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.message || "请求失败");
        return;
      }
      if (data?.data?.token) {
        localStorage.setItem("auth_token", data.data.token);
        fetchFavorites(data.data.token);
        fetchProfile(data.data.token);
        fetchLogs(data.data.token);
      }
      if (data?.data?.username) {
        setCurrentUser(data.data.username);
        localStorage.setItem("auth_user", data.data.username);
      }
      setStatus(data?.message || "成功");
    } catch (error) {
      setStatus("网络错误");
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileStatus("");
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setProfileStatus("请先登录");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok || data?.code !== 200) {
        setProfileStatus(data?.message || "保存失败");
        return;
      }
      setProfileStatus("已保存");
      fetchProfile(token);
    } catch (error) {
      setProfileStatus("网络错误");
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordStatus("");
    if (!passwordForm.current || !passwordForm.next) {
      setPasswordStatus("请填写完整");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus("两次密码不一致");
      return;
    }
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setPasswordStatus("请先登录");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.next,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.code !== 200) {
        setPasswordStatus(data?.message || "修改失败");
        return;
      }
      setPasswordStatus("密码已更新");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      setPasswordStatus("网络错误");
    }
  };

  const copyText = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // ignore
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setCurrentUser("");
    setFavorites([]);
    setLogs([]);
    setProfile({ nickname: "", signature: "", avatar_url: "" });
  };

  const handleDeleteSubmit = (event) => {
    event.preventDefault();
    setDeleteStatus("");
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setDeleteStatus("请先登录");
      return;
    }
    if (!deleteForm.password) {
      setDeleteStatus("请输入密码");
      return;
    }
    setConfirmDialog({ open: true, type: "delete" });
  };

  const deleteAccount = async () => {
    setDeleteStatus("");
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setDeleteStatus("请先登录");
      return;
    }
    if (!deleteForm.password) {
      setDeleteStatus("请输入密码");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: deleteForm.password }),
      });
      const data = await res.json();
      if (!res.ok || data?.code !== 200) {
        setDeleteStatus(data?.message || "注销失败");
        return;
      }
      setDeleteStatus("账号已注销");
      setDeleteForm({ password: "" });
      await logout();
    } catch (error) {
      setDeleteStatus("网络错误");
    }
  };

  const toggleFavorite = async (track) => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setStatus("请先登录再收藏");
      return;
    }
    const exists = favorites.some(
      (item) => item.id === track.id && item.source === track.source
    );
    try {
      if (exists) {
        const params = new URLSearchParams({
          id: track.id,
          source: track.source,
        });
        await fetch(`${API_BASE}/favorites?${params.toString()}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await fetch(`${API_BASE}/favorites`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(track),
        });
      }
      fetchFavorites(token);
    } catch (error) {
      setStatus("收藏操作失败");
    }
  };

  const normalizeTrack = (item, sourceFallback) => ({
    id: item.id,
    name: item.name,
    artist: item.artist,
    source: item.source || item.platform || sourceFallback,
  });

  const buildQueue = (list, sourceFallback) =>
    list.map((item) => normalizeTrack(item, sourceFallback));

  const setQueueAndPlay = (list, item, sourceFallback) => {
    const queue = buildQueue(list, sourceFallback);
    const target = normalizeTrack(item, sourceFallback);
    const index = queue.findIndex(
      (track) => track.id === target.id && track.source === target.source
    );
    const resolvedIndex = index >= 0 ? index : 0;
    setPlayQueue(queue);
    setCurrentIndex(resolvedIndex);
    setCurrentTrack(queue[resolvedIndex] || target);
    setPlayHistory(resolvedIndex >= 0 ? [resolvedIndex] : []);
  };

  const playTrack = (item, list = playQueue) => {
    if (list && list.length) {
      setQueueAndPlay(list, item, searchSource);
      return;
    }
    const track = normalizeTrack(item, searchSource);
    setCurrentTrack(track);
  };

  const getNextIndex = () => {
    if (!playQueue.length || currentIndex < 0) return -1;
    if (playMode === "single") return currentIndex;
    if (playMode === "shuffle") {
      if (playQueue.length === 1) return currentIndex;
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * playQueue.length);
      }
      return next;
    }
    if (playMode === "loop") {
      return (currentIndex + 1) % playQueue.length;
    }
    if (currentIndex + 1 >= playQueue.length) return -1;
    return currentIndex + 1;
  };

  const goNext = () => {
    const nextIndex = getNextIndex();
    if (nextIndex < 0) {
      setIsPlaying(false);
      return;
    }
    setCurrentIndex(nextIndex);
    setCurrentTrack(playQueue[nextIndex]);
    setPlayHistory((history) => [...history, nextIndex]);
  };

  const goPrev = () => {
    if (!playQueue.length) return;
    setPlayHistory((history) => {
      if (history.length >= 2) {
        const updated = [...history];
        updated.pop();
        const prevIndex = updated[updated.length - 1];
        setCurrentIndex(prevIndex);
        setCurrentTrack(playQueue[prevIndex]);
        return updated;
      }
      let prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = playMode === "loop" ? playQueue.length - 1 : 0;
      }
      setCurrentIndex(prevIndex);
      setCurrentTrack(playQueue[prevIndex]);
      return [prevIndex];
    });
  };

  const cyclePlayMode = () => {
    const modes = ["order", "loop", "single", "shuffle"];
    const idx = modes.indexOf(playMode);
    setPlayMode(modes[(idx + 1) % modes.length]);
  };

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    audioRef.current.load();
    audioRef.current
      .play()
      .then(() => {})
      .catch(() => {});
    setIsPlaying(true);
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;
    const fetchLyrics = async () => {
      setLyricsLoading(true);
      setLyricsError("");
      setLyrics([]);
      setActiveLyricIndex(-1);
      try {
        const params = new URLSearchParams({
          type: "lrc",
          source: currentTrack.source,
          id: currentTrack.id,
        });
        const res = await fetch(`${API_BASE}/api/?${params.toString()}`);
        const text = await res.text();
        if (!res.ok) {
          setLyricsError("歌词加载失败");
          return;
        }
        const lines = text.split("\n").map((line) => line.replace(/\r/g, ""));
        const parsed = [];
        for (const line of lines) {
          const timeTags = [...line.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
          const textPart = line.replace(/\[[0-9:.]+\]/g, "").trim();
          if (!textPart) continue;
          if (timeTags.length === 0) {
            parsed.push({ time: null, text: textPart });
            continue;
          }
          for (const tag of timeTags) {
            const minutes = Number(tag[1] || 0);
            const seconds = Number(tag[2] || 0);
            const millis = Number(tag[3] || 0);
            const time = minutes * 60 + seconds + millis / 1000;
            parsed.push({ time, text: textPart });
          }
        }
        parsed.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
        setLyrics(parsed.length ? parsed : [{ time: null, text: "暂无歌词" }]);
      } catch (error) {
        setLyricsError("网络错误");
      } finally {
        setLyricsLoading(false);
      }
    };
    fetchLyrics();
  }, [currentTrack]);

  const updateActiveLyric = (time) => {
    if (!lyrics.length) return;
    let index = -1;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (lyrics[i].time === null) continue;
      if (time >= lyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    if (index !== activeLyricIndex) {
      setActiveLyricIndex(index);
    }
  };

  const lyricWindow = (() => {
    if (!lyrics.length) return { lines: [], start: 0 };
    if (activeLyricIndex < 0) return { lines: lyrics.slice(0, 5), start: 0 };
    const start = Math.max(activeLyricIndex - 2, 0);
    return { lines: lyrics.slice(start, start + 5), start };
  })();

  const pagedFavorites = paginate(
    favorites,
    favoritePage,
    PAGE_SIZES.favorites
  );
  const pagedLogs = paginate(logs, logPage, PAGE_SIZES.logs);
  const pagedSearch = paginate(
    searchResults,
    searchPage,
    PAGE_SIZES.search
  );

  useEffect(() => {
    if (!lyricsBoxRef.current || activeLyricIndex < 0) return;
    const nodes = lyricsBoxRef.current.querySelectorAll("p");
    const idx = activeLyricIndex - lyricWindow.start;
    const node = nodes[idx];
    if (node) {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeLyricIndex, lyricWindow.start]);

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime ?? 0;
    setCurrentTime(time);
    updateActiveLyric(time);
  };

  const handleLoadedMetadata = () => {
    const total = audioRef.current?.duration ?? 0;
    setDuration(Number.isFinite(total) ? total : 0);
  };

  const seekTo = (event) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(audioRef.current.currentTime);
    updateActiveLyric(audioRef.current.currentTime);
  };

  const formatTime = (value) => {
    if (!Number.isFinite(value)) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };


  useEffect(() => {
    const fetchCharts = async () => {
      setChartsLoading(true);
      setChartsError("");
      try {
        const params = new URLSearchParams({
          type: "toplists",
          source: searchSource,
        });
        const res = await fetch(`${API_BASE}/api/?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || data?.code !== 200) {
          setChartsError(data?.message || "获取榜单失败");
          setCharts([]);
          return;
        }
        const list = (data?.data?.list || []).map((item, index) => ({
          ...item,
          accent: chartAccent[index % chartAccent.length],
        }));
        setCharts(list);
      } catch (error) {
        setChartsError("网络错误");
        setCharts([]);
      } finally {
        setChartsLoading(false);
      }
    };
    fetchCharts();
  }, [searchSource]);

  const fetchChartSongs = async (chart) => {
    if (!chart?.id) return;
    setActiveChart(chart);
    setChartSongs([]);
    setChartSongsLoading(true);
    setChartSongsError("");
    try {
      const params = new URLSearchParams({
        type: "toplist",
        source: searchSource,
        id: chart.id,
      });
      const res = await fetch(`${API_BASE}/api/?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data?.code !== 200) {
        setChartSongsError(data?.message || "获取榜单歌曲失败");
        return;
      }
      setChartSongs(data?.data?.list || []);
    } catch (error) {
      setChartSongsError("网络错误");
    } finally {
      setChartSongsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      startVisualizer();
      audioRef.current.play().catch(() => {});
    }
  };

  const setupVisualizer = () => {
    if (!audioRef.current || analyserRef.current) return;
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (error) {
      analyserRef.current = null;
    }
  };

  const drawBars = (canvas, analyser) => {
    const ctx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    analyser.getByteFrequencyData(dataArray);
    const bands = 36;
    const bandSize = Math.floor(bufferLength / bands);
    const gap = 3;
    const barWidth = (width - gap * (bands - 1)) / bands;
    if (!peakRef.current.length) {
      peakRef.current = new Array(bands).fill(0);
    }
    for (let i = 0; i < bands; i += 1) {
      let sum = 0;
      for (let j = 0; j < bandSize; j += 1) {
        sum += dataArray[i * bandSize + j];
      }
      const avg = sum / bandSize;
      const energy = Math.min(avg / 255, 1);
      const eased = Math.pow(energy, 1.1);
      const barHeight = Math.max(6, eased * height * 1.2);
      const x = i * (barWidth + gap);
      const hue = 200 + eased * 80;
      const alpha = 0.45 + eased * 0.5;
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 65%, ${alpha})`);
      gradient.addColorStop(1, `hsla(${hue + 30}, 90%, 78%, ${alpha})`);
      ctx.fillStyle = gradient;
      drawRoundedBar(ctx, x, height - barHeight, barWidth, barHeight, 6);

      const peak = peakRef.current[i];
      const nextPeak = Math.max(barHeight, peak - 1.4);
      peakRef.current[i] = nextPeak;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      drawRoundedBar(ctx, x, height - nextPeak - 2, barWidth, 3, 2);
    }
  };

  const drawVisualizer = () => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const lyricsCanvas = lyricsCanvasRef.current;
    if (!analyser) return;
    if (canvas) drawBars(canvas, analyser);
    if (lyricsCanvas) drawBars(lyricsCanvas, analyser);
    rafRef.current = requestAnimationFrame(drawVisualizer);
  };

  const startVisualizer = () => {
    setupVisualizer();
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 24;
      canvas.width = width;
      canvas.height = height;
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawVisualizer);
  };

  const stopVisualizer = () => {
    cancelAnimationFrame(rafRef.current);
  };

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  return (
    <div className="page">
      {showIntro ? (
        <div className="intro">
          <div className="intro-clouds">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="intro-card">
            <div className="intro-ribbon" />
            <h1>随心所动 且听风吟</h1>
            <h2>
              <span className="intro-emphasis">不用会员 听你所想</span>
            </h2>
            <div className="intro-stars">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      ) : null}
      <div className={`dashboard ${lyricsOpen ? "lyrics-open" : ""}`}>
        <header className="topbar">
          <div className="logo">
            <span className="logo-title">随心所动</span>
            <span className="logo-sub">Sway Player</span>
          </div>
          <form className="search" onSubmit={runSearch}>
            <SearchIcon />
            <input
              aria-label="Search music tracks"
              placeholder="搜索 100,000+ 首音乐"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
            <button type="submit" aria-label="Search">
              搜索
            </button>
          </form>
          <div className="account-entry">
            <button
              className="avatar"
              type="button"
              title="个人中心"
              aria-label="个人中心"
              onClick={() => {
                setDrawerOpen((value) => !value);
                const token = localStorage.getItem("auth_token");
                if (token) {
                  fetchProfile(token);
                  fetchLogs(token);
                }
              }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" />
              ) : (
                <span className="avatar-fallback">
                  {currentUser ? currentUser.slice(0, 1).toUpperCase() : "我"}
                </span>
              )}
            </button>
            <span className="account-label">
              {currentUser ? "个人中心" : "登录/注册"}
            </span>
          </div>
        </header>

        <main className="content">
          <section className="weekly">
            <div className="section-head">
              <div className="section-title">榜单精选</div>
              <button
                className="section-more"
                type="button"
                onClick={() => setShowAllCharts((value) => !value)}
              >
                {showAllCharts ? "收起榜单" : "查看更多"}
              </button>
            </div>
            <div className="weekly-grid">
              {chartsLoading ? (
                <div className="chart-hint">加载榜单中…</div>
              ) : null}
              {chartsError ? <div className="chart-hint">{chartsError}</div> : null}
              {(showAllCharts ? charts : charts.slice(0, 5)).map((item, index) => (
                <button
                  className={`mini-card ${item.accent}`}
                  key={item.id || item.name}
                  type="button"
                  onClick={() => fetchChartSongs(item)}
                >
                  <div className="mini-cover">
                    <span className="mini-rank">{index + 1}</span>
                  </div>
                  <div className="mini-text">
                    <h4>{item.name}</h4>
                    <span>{item.updateFrequency || "榜单更新"}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className={`chart-drawer ${activeChart ? "open" : ""}`}>
            <div
              className="chart-drawer-backdrop"
              onClick={() => setActiveChart(null)}
              aria-hidden="true"
            />
            <section className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="section-title">榜单明细</div>
                  <span>{activeChart?.name || "请选择一个榜单"}</span>
                </div>
                <button
                  className="chart-close"
                  type="button"
                  onClick={() => setActiveChart(null)}
                >
                  关闭
                </button>
              </div>
              <div className="chart-panel-body">
                {chartSongsLoading ? (
                  <div className="chart-hint">加载榜单歌曲中…</div>
                ) : null}
                {chartSongsError ? (
                  <div className="chart-hint">{chartSongsError}</div>
                ) : null}
                {!chartSongsLoading &&
                !chartSongsError &&
                chartSongs.length === 0 ? (
                  <div className="chart-hint">暂无歌曲</div>
                ) : null}
                <div className="chart-list">
                  {chartSongs.map((song, index) => (
                    <div className="chart-item" key={`${song.id}-${index}`}>
                      <span className="chart-index">{index + 1}</span>
                      <div className="chart-meta">
                        <strong>{song.name}</strong>
                        <span>{song.artist || "未知歌手"}</span>
                      </div>
                      <button
                        className="chart-play"
                        type="button"
                        onClick={() =>
                          playTrack({
                            id: song.id,
                            name: song.name,
                            artist: song.artist,
                            platform: searchSource,
                          }, chartSongs)
                        }
                      >
                        播放
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="search-panel">
            <div className="search-panel-head">
              <div className="section-title">搜索结果</div>
              <select
                value={searchSource}
                onChange={(event) => setSearchSource(event.target.value)}
                aria-label="Select music source"
              >
                <option value="netease">网易云音乐</option>
                <option value="kuwo">酷我音乐</option>
                <option value="qq">QQ音乐</option>
              </select>
            </div>
            <div className="search-panel-body">
              {searchLoading ? (
                <div className="search-hint">搜索中…</div>
              ) : null}
              {searchError ? (
                <div className="search-hint">{searchError}</div>
              ) : null}
              {!searchLoading && !searchError && searchResults.length === 0 ? (
                <div className="search-hint">暂无搜索结果</div>
              ) : null}
              <div className="search-list">
                {pagedSearch.items.map((item) => (
                  <div className="search-item" key={`${item.platform}-${item.id}`}>
                    <div
                      className="search-thumb"
                      style={{
                        backgroundImage: `url(${API_BASE}/api/?source=${
                          item.platform || searchSource
                        }&id=${item.id}&type=pic)`,
                      }}
                    />
                    <div className="search-meta">
                      <strong>{item.name}</strong>
                      <span>{item.artist}</span>
                    </div>
                    <button
                      className="search-play"
                      type="button"
                      onClick={() => playTrack(item, searchResults)}
                    >
                      播放
                    </button>
                  </div>
                ))}
              </div>
              {searchResults.length > PAGE_SIZES.search ? (
                <Pagination
                  page={searchPage}
                  total={searchResults.length}
                  pageSize={PAGE_SIZES.search}
                  onChange={setSearchPage}
                />
              ) : null}
            </div>
          </section>

        </main>

        <aside className="favorites">
          <h3>收藏夹</h3>
          <div className="favorite-list">
            {favoritesLoading ? (
              <div className="favorite-hint">加载收藏中…</div>
            ) : null}
            {!favoritesLoading && favorites.length === 0 ? (
              <div className="favorite-hint">
                {currentUser ? "暂无收藏歌曲" : "登录后显示收藏歌曲"}
              </div>
            ) : null}
            {pagedFavorites.items.map((track) => (
              <div className="favorite-row" key={`${track.source}-${track.id}`}>
                <button
                  className="favorite-thumb"
                  type="button"
                  onClick={() => playTrack(track, favorites)}
                  aria-label={`Play ${track.name}`}
                >
                  <img
                    src={`${API_BASE}/api/?source=${track.source}&id=${track.id}&type=pic`}
                    alt={`${track.name} cover`}
                  />
                </button>
                <div className="favorite-meta">
                  <strong>{track.name}</strong>
                  <span>{track.artist}</span>
                </div>
                <button
                  className="favorite-play"
                  type="button"
                  onClick={() => playTrack(track, favorites)}
                  aria-label="Play favorite"
                >
                  <PlayIcon />
                </button>
                <button
                  className="favorite-heart active"
                  aria-label="Toggle favorite"
                  onClick={() =>
                    toggleFavorite({
                      id: track.id,
                      source: track.source,
                      name: track.name,
                      artist: track.artist,
                    })
                  }
                >
                  <HeartIcon filled />
                </button>
              </div>
            ))}
          </div>
          {favorites.length > PAGE_SIZES.favorites ? (
            <Pagination
              page={favoritePage}
              total={favorites.length}
              pageSize={PAGE_SIZES.favorites}
              onChange={setFavoritePage}
            />
          ) : null}
        </aside>

        <div className={`profile-drawer ${drawerOpen ? "open" : ""}`}>
          <div
            className="profile-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="profile-panel">
            <div className="profile-header">
              <div>
                <strong>账号中心</strong>
                <span>资料与登录记录</span>
              </div>
              <button
                className="profile-close"
                type="button"
                onClick={() => setDrawerOpen(false)}
              >
                关闭
              </button>
            </div>
            {currentUser ? (
              <div className="profile-section">
                <div className="profile-user">
                  <div className="profile-avatar">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" />
                    ) : (
                      <span className="profile-avatar-fallback">
                        {currentUser.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4>{profile.nickname || currentUser}</h4>
                    <p>{profile.signature || "写点喜欢的音乐故事"}</p>
                  </div>
                </div>
                <div className="profile-actions">
                  <button
                    className="logout primary"
                    type="button"
                    onClick={() => setConfirmDialog({ open: true, type: "logout" })}
                  >
                    退出登录
                  </button>
                  <button
                    className="danger-outline"
                    type="button"
                    onClick={() => {
                      setDeleteStatus("");
                      setConfirmDialog({ open: true, type: "delete" });
                    }}
                  >
                    注销账号
                  </button>
                </div>
                <form className="profile-form" onSubmit={submitProfile}>
                  <label>
                    昵称
                    <input
                      value={profile.nickname}
                      onChange={(event) =>
                        setProfile((prev) => ({
                          ...prev,
                          nickname: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    个性签名
                    <input
                      value={profile.signature}
                      onChange={(event) =>
                        setProfile((prev) => ({
                          ...prev,
                          signature: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    头像链接
                    <input
                      value={profile.avatar_url}
                      onChange={(event) =>
                        setProfile((prev) => ({
                          ...prev,
                          avatar_url: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit">保存资料</button>
                  {profileStatus ? (
                    <span className="profile-status">{profileStatus}</span>
                  ) : null}
                </form>
                <form className="password-form" onSubmit={submitPassword}>
                  <div className="profile-subtitle">修改密码</div>
                  <input
                    type="password"
                    placeholder="原密码"
                    value={passwordForm.current}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        current: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="password"
                    placeholder="新密码"
                    value={passwordForm.next}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        next: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="password"
                    placeholder="确认新密码"
                    value={passwordForm.confirm}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirm: event.target.value,
                      }))
                    }
                  />
                  <button type="submit">更新密码</button>
                  {passwordStatus ? (
                    <span className="profile-status">{passwordStatus}</span>
                  ) : null}
                </form>
                <div className="profile-logs">
                  <div className="profile-subtitle">登录日志</div>
                  <div className="log-list">
                    {logs.length === 0 ? (
                      <div className="log-empty">暂无记录</div>
                    ) : null}
                    {pagedLogs.items.map((log, index) => (
                      <button
                        className="log-row"
                        type="button"
                        key={`${log.time}-${index}`}
                        onClick={() => setActiveLog(log)}
                      >
                        <span className="log-device">
                          {log.device?.split(" ")[0] || "unknown"}
                        </span>
                        <span>{log.ip}</span>
                        <span>{log.time}</span>
                      </button>
                    ))}
                  </div>
                  {logs.length > PAGE_SIZES.logs ? (
                    <Pagination
                      page={logPage}
                      total={logs.length}
                      pageSize={PAGE_SIZES.logs}
                      onChange={setLogPage}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="profile-section">
                <div className="auth-card">
                  <div className="auth-header">
                    <strong>{mode === "login" ? "欢迎回来" : "创建新账号"}</strong>
                    <span>同步你的收藏与播放记录</span>
                  </div>
                  <div className="auth-tabs">
                    <button
                      className={mode === "login" ? "active" : ""}
                      onClick={() => setMode("login")}
                      type="button"
                    >
                      登录
                    </button>
                    <button
                      className={mode === "register" ? "active" : ""}
                      onClick={() => setMode("register")}
                      type="button"
                    >
                      注册
                    </button>
                  </div>
                  <form className="auth-form" onSubmit={submitAuth}>
                    <input
                      placeholder="用户名"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                    />
                    <input
                      type="password"
                      placeholder="密码"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button type="submit">
                      {mode === "login" ? "立即登录" : "创建账号"}
                    </button>
                  </form>
                  <div className="auth-welcome">
                    新朋友可以直接 <span>注册账号</span> 开始体验。
                  </div>
                  {status ? <div className="auth-status">{status}</div> : null}
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className={`log-modal ${activeLog ? "open" : ""}`}>
          <div
            className="log-backdrop"
            onClick={() => setActiveLog(null)}
            aria-hidden="true"
          />
          <div className="log-panel">
            <div className="log-panel-head">
              <strong>登录详情</strong>
              <button type="button" onClick={() => setActiveLog(null)}>
                关闭
              </button>
            </div>
            <div className="log-panel-body">
              <div>
                <span>设备</span>
                <div className="log-copy-row">
                  <p>{activeLog?.device || "unknown"}</p>
                  <button
                    type="button"
                    onClick={() => copyText(activeLog?.device)}
                  >
                    复制
                  </button>
                </div>
              </div>
              <div>
                <span>IP</span>
                <div className="log-copy-row">
                  <p>{activeLog?.ip || "unknown"}</p>
                  <button type="button" onClick={() => copyText(activeLog?.ip)}>
                    复制
                  </button>
                </div>
              </div>
              <div>
                <span>时间</span>
                <p>{activeLog?.time || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`confirm-modal ${confirmDialog.open ? "open" : ""}`}>
          <div
            className="confirm-backdrop"
            onClick={() => setConfirmDialog({ open: false, type: null })}
            aria-hidden="true"
          />
          <div className="confirm-panel" role="dialog" aria-modal="true">
            <div className="confirm-header">
              <strong>
                {confirmDialog.type === "delete" ? "确认注销账号" : "确认退出登录"}
              </strong>
              <span>
                {confirmDialog.type === "delete"
                  ? "注销后将清空账号数据，且不可恢复。"
                  : "退出后需要重新登录才能继续使用。"}
              </span>
            </div>
            {confirmDialog.type === "delete" ? (
              <div className="confirm-input">
                <label htmlFor="confirm-delete-password">请输入密码确认</label>
                <input
                  id="confirm-delete-password"
                  type="password"
                  placeholder="账号密码"
                  value={deleteForm.password}
                  onChange={(event) =>
                    setDeleteForm({ password: event.target.value })
                  }
                />
                {deleteStatus ? (
                  <span className="profile-status">{deleteStatus}</span>
                ) : null}
              </div>
            ) : null}
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => setConfirmDialog({ open: false, type: null })}
              >
                取消
              </button>
              <button
                type="button"
                className="confirm-danger"
                disabled={confirmDialog.type === "delete" && !deleteForm.password}
                onClick={async () => {
                  if (confirmDialog.type === "delete") {
                    await deleteAccount();
                  } else {
                    await logout();
                  }
                  setConfirmDialog({ open: false, type: null });
                }}
              >
                {confirmDialog.type === "delete" ? "确认注销" : "确认退出"}
              </button>
            </div>
          </div>
        </div>

        <footer className={`player ${lyricsOpen ? "expanded" : ""}`}>
          <div className="now-playing">
            <div className="album">
              {currentTrack ? (
                <img
                  src={`${API_BASE}/api/?source=${currentTrack.source}&id=${currentTrack.id}&type=pic`}
                  alt={`${currentTrack.name} cover`}
                />
              ) : null}
            </div>
            <div className="now-text">
              <div className="marquee">
                <strong>{currentTrack?.name || "选择一首歌播放"}</strong>
              </div>
              <div className="marquee muted">
                <span>{currentTrack?.artist || "随心所动"}</span>
              </div>
            </div>
          </div>
          <div className="controls">
            <button aria-label="Previous" onClick={goPrev}>
              <SkipIcon direction="prev" />
            </button>
            <button
              className="control-play"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button aria-label="Next" onClick={goNext}>
              <SkipIcon direction="next" />
            </button>
          </div>
          <div className="timeline">
            <span>{formatTime(currentTime)}</span>
            <div className={`bar-wrap ${lyricsOpen ? "no-visualizer" : ""}`}>
              {lyricsOpen ? null : (
                <canvas className="visualizer" ref={canvasRef} />
              )}
              <div className="bar" ref={progressRef} onClick={seekTo}>
                <div
                  className="bar-progress"
                  style={{
                    width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="player-actions">
            <button
              className={`lyrics-toggle ${lyricsOpen ? "active" : ""}`}
              type="button"
              onClick={() => setLyricsOpen((value) => !value)}
            >
              词
            </button>
            <button className="mode-toggle" type="button" onClick={cyclePlayMode}>
              {playMode === "order" ? "顺序" : null}
              {playMode === "loop" ? "列表循环" : null}
              {playMode === "single" ? "单曲" : null}
              {playMode === "shuffle" ? "随机" : null}
            </button>
            <div className="volume-control">
              <button
                className={`mute-toggle ${isMuted ? "active" : ""}`}
                type="button"
                onClick={() => setIsMuted((value) => !value)}
                aria-label="Toggle mute"
              >
                <VolumeIcon />
              </button>
              <div className="volume-pop">
                <input
                  className="volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(event) => {
                    setIsMuted(false);
                    setVolume(Number(event.target.value));
                  }}
                  aria-label="Volume"
                />
              </div>
            </div>
            <button
              className={`favorite-action ${
                favorites.some(
                  (item) =>
                    item.id === currentTrack?.id &&
                    item.source === currentTrack?.source
                )
                  ? "active"
                  : ""
              } ${currentUser ? "" : "disabled"}`}
              type="button"
              onClick={() => {
                if (!currentUser) {
                  setStatus("请先登录");
                  setDrawerOpen(true);
                  return;
                }
                if (currentTrack) {
                  toggleFavorite({
                    id: currentTrack.id,
                    source: currentTrack.source,
                    name: currentTrack.name,
                    artist: currentTrack.artist,
                  });
                }
              }}
              title={currentUser ? "收藏" : "请先登录"}
            >
              <HeartIcon
                filled={favorites.some(
                  (item) =>
                    item.id === currentTrack?.id &&
                    item.source === currentTrack?.source
                )}
              />
            </button>
          </div>
          <audio
            ref={audioRef}
            preload="none"
            crossOrigin="anonymous"
            src={
              currentTrack
                ? `${API_BASE}/api/?source=${currentTrack.source}&id=${currentTrack.id}&type=url&br=320k`
                : ""
            }
            onPlay={() => {
              setIsPlaying(true);
              startVisualizer();
            }}
            onPause={() => {
              setIsPlaying(false);
              stopVisualizer();
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => {
              stopVisualizer();
              goNext();
            }}
          />
          <div className="lyrics-panel">
            <div className="lyrics-backdrop">
              <span />
              <span />
              <span />
            </div>
            <div className="lyrics-hero">
              <div className={`lyrics-cover ${isPlaying ? "spinning" : ""}`}>
                {currentTrack ? (
                  <img
                    src={`${API_BASE}/api/?source=${currentTrack.source}&id=${currentTrack.id}&type=pic`}
                    alt={`${currentTrack.name} cover`}
                  />
                ) : null}
              </div>
              <div className="lyrics-meta">
                <h3>{currentTrack?.name || "随心所动"}</h3>
                <p>{currentTrack?.artist || "选择一首歌播放"}</p>
              </div>
            </div>
            <div className="lyrics-body">
              {lyricsLoading ? (
                <div className="lyrics-hint">歌词加载中…</div>
              ) : null}
              {lyricsError ? (
                <div className="lyrics-hint">{lyricsError}</div>
              ) : null}
              {!lyricsLoading && !lyricsError && lyrics.length === 0 ? (
                <div className="lyrics-hint">暂无歌词</div>
              ) : null}
              <div className="lyrics-lines" ref={lyricsBoxRef}>
                {lyricWindow.lines.map((line, index) => {
                  const absoluteIndex = lyricWindow.start + index;
                  return (
                    <p
                      key={`${line.text}-${absoluteIndex}`}
                      className={
                        absoluteIndex === activeLyricIndex ? "active" : ""
                      }
                    >
                      {line.text}
                    </p>
                  );
                })}
              </div>
              <div className="lyrics-spectrum">
                <canvas className="visualizer" ref={lyricsCanvasRef} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="7,5 20,12 7,19" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  );
}

function SkipIcon({ direction = "next" }) {
  const isPrev = direction === "prev";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={isPrev ? "17,5 8,12 17,19" : "7,5 16,12 7,19"} />
      <rect x={isPrev ? "6" : "17"} y="5" width="2" height="14" rx="1" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9h4l5-4v14l-5-4H5z" />
      <path d="M17 9c1.5 1.3 1.5 4.7 0 6" />
    </svg>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-filled={filled}>
      <path d="M12 20s-6.5-4.1-9-8.2C1 8.5 2.7 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.3 0 5 3.5 3 6.8-2.5 4.1-9 8.2-9 8.2z" />
    </svg>
  );
}

function drawRoundedBar(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function paginate(list, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    current,
    totalPages,
  };
}

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
