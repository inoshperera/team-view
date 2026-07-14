/* eslint-disable */
// App root — owns auth, routing, and the task store.

const STORAGE_USER = "thlv.user";
const STORAGE_TASKS = "thlv.tasks";

const useStoredState = (key, fallback) => {
  const [val, setVal] = React.useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  });
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
};

const App = () => {
  const [user, setUser] = useStoredState(STORAGE_USER, null);
  const [tasks, setTasks] = useStoredState(STORAGE_TASKS, SEED_TASKS);

  // route: "dashboard" | "drilldown"
  const [route, setRoute] = React.useState({ name: "dashboard" });

  // editor state
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);

  // toggles (mostly tweakable)
  const [layout, setLayout] = React.useState("lanes"); // lanes | list
  const [groupMode, setGroupMode] = React.useState("priority"); // priority | category

  // ---------- handlers ----------
  const onLogin = (u) => setUser(u);
  const onLogout = () => { setUser(null); setRoute({ name: "dashboard" }); };

  const openCreate = () => { setEditingTask(null); setEditorOpen(true); };
  const openEdit = (task) => { setEditingTask(task); setEditorOpen(true); };
  const saveTask = (task) => {
    setTasks(prev => {
      const exists = prev.some(t => t.id === task.id);
      return exists ? prev.map(t => t.id === task.id ? task : t) : [task, ...prev];
    });
  };
  const deleteTask = (task) => {
    if (!task) return;
    setTasks(prev => prev.filter(t => t.id !== task.id));
  };

  const onDrilldown = (teamId) => setRoute({ name: "drilldown", teamId });
  const backToDashboard = () => setRoute({ name: "dashboard" });

  // Reset demo data hook (used by tweaks panel)
  React.useEffect(() => {
    window.__resetDemo = () => {
      setTasks(SEED_TASKS);
      setUser(null);
      setRoute({ name: "dashboard" });
    };
  }, [setTasks, setUser]);

  // ---------- render ----------
  if (!user) return <LoginScreen onLogin={onLogin} />;

  if (route.name === "drilldown") {
    return (
      <main className="app-shell">
        <Drilldown teamId={route.teamId} onClose={backToDashboard} />
      </main>
    );
  }

  const teamForEditor = (() => {
    if (user.role === "lead") return { id: user.teamId, name: TEAMS.find(t => t.id === user.teamId)?.name };
    if (editingTask && editingTask.teamId) return { id: editingTask.teamId, name: TEAMS.find(t => t.id === editingTask.teamId)?.name };
    return { id: TEAMS[0].id, name: TEAMS[0].name };
  })();

  return (
    <>
      {user.role === "lead" ? (
        <TeamLeadDashboard
          user={user}
          tasks={tasks}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={deleteTask}
          onLogout={onLogout}
          onDrilldown={onDrilldown}
          layout={layout}
          groupMode={groupMode}
          onLayoutChange={setLayout}
          onGroupChange={setGroupMode}
        />
      ) : (
        <ManagerDashboard
          user={user}
          tasks={tasks}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={deleteTask}
          onLogout={onLogout}
          onDrilldown={onDrilldown}
          layout={layout}
          groupMode={groupMode}
          onLayoutChange={setLayout}
          onGroupChange={setGroupMode}
        />
      )}
      <TaskEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={saveTask}
        onDelete={deleteTask}
        initial={editingTask}
        teamId={teamForEditor.id}
        teamName={teamForEditor.name}
      />
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
