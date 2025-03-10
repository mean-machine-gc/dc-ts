export type Mod<C, E, S, F> = {
    cmds: C,
    evts: E,
    state: S,
    failures: F
}