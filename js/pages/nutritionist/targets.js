/**
 * 營養師編輯當日營養目標。
 */
import { toast } from "../../components/toast.js";
import { render, startPage } from "../../core/app-shell.js";
import { state } from "../../core/state.js";
import { mountTargetTemplates, mountTargets } from "../shared/targets.js";
import { view } from "../shared/screens.js";
startPage({
  role: "nutritionist",
  route: "targets",
  render: (pageState) => view("targets", pageState.data, "nutritionist", pageState.filter, pageState),
  mount() {
    const templateRoot = document.querySelector("#target-templates-root");
    const dailyRoot = document.querySelector("#daily-target-root");
    if (!templateRoot || !dailyRoot) return;
    const templates = mountTargetTemplates(templateRoot, {
      data: state.data,
      date: state.date,
      playerId: state.targetPlayer,
      onSaved: render,
      notify: toast,
    });
    mountTargets(dailyRoot, {
      data: state.data,
      date: state.date,
      playerId: state.targetPlayer,
      onPlayer: (id) => {
        state.targetPlayer = id;
        sessionStorage.setItem("targetPlayer", id);
        templates.setPlayer(id);
      },
      onSaved: render,
      notify: toast,
    });
  },
});
