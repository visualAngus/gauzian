import { describe,it,expect,vi,beforAach,afterEach } from "vitest";
import { useNotification } from "~/composables/useNotification";

describe("useNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("commence avec une liste de notifications vide", () => {
    const { notifications } = useNotification();
    expect(notifications.value).toEqual([]);
  });

it("ajoute une notification", () => {
    const { notifications, addNotification } = useNotification();
    addNotification({
            message: "Test message",
            type: "success",
    });
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0]).toMatchObject({
            message: "Test message",
            title: "Notification",
    });
    expect(typeof notifications.value[0].id).toBe("string");
});

  it("le titre par défaut est 'Notification'", () => {
    const { notifications, addNotification } = useNotification();
    addNotification({
        message: "Message sans titre",
        type: "info"
    });
    expect(notifications.value[0].title).toBe("Notification");
  });

  it("supprimer une notification via l'id", () => {
    const { notifications, addNotification, removeNotification } = useNotification();
    addNotification({
        message: "Message à supprimer",
        type: "warning"
    });
    const id = notifications.value[0].id;
    removeNotification(id);
    expect(notifications.value).toHaveLength(0);
  });

  it("supprimer une notification après 5 secondes", () => {
    const { notifications, addNotification } = useNotification();
    addNotification({
        message: "Message temporaire",
        type: "error"
    });
    expect(notifications.value).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(notifications.value).toHaveLength(0);
  });

  it("deux notifications différentes ont des ids différents", () => {
    const { notifications, addNotification } = useNotification();
    addNotification({
        message: "Premier message",
        type: "info"
    });
    addNotification({
        message: "Deuxième message",
        type: "info"
    });
    expect(notifications.value[0].id).not.toBe(notifications.value[1].id);
  });
  it("deux notifications coexistent sans se supprimer mutuellement", () => {
    const { notifications, addNotification } = useNotification();
    addNotification({
        message: "Premier message",
        type: "info"
    });
    addNotification({
        message: "Deuxième message",
        type: "info"
    });
    expect(notifications.value).toHaveLength(2);
  });
});