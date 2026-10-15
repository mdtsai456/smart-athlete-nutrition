/**
 * 營養師編輯當日營養目標。
 */
import { toast } from "../../components/toast.js";
import { render, startPage } from "../../core/app-shell.js";
import { state } from "../../core/state.js";
import { mountTargets } from "../shared/targets.js";
import { view } from "../shared/screens.js";
startPage({
  role: "nutritionist",
  route: "targets",
  render: (pageState) => view("targets", pageState.data, "nutritionist", pageState),
  mount() {
    const root = document.querySelector("#targets-root");
    if (!root) return;
    mountTargets(root, {
      data: state.data,
      date: state.date,
      playerId: state.targetPlayer,
      onPlayer: (id) => {
        state.targetPlayer = id;
        sessionStorage.setItem("targetPlayer", id);
      },
      onSaved: render,
      notify: toast,
    });
  },
});
