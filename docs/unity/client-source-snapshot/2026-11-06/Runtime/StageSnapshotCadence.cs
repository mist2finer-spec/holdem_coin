namespace IslandGame {
 // Presentation publication only. Fixed simulation steps and command ordering are unchanged.
 public sealed class StageSnapshotCadence {
  double pressureUntil;
  public int IntervalMilliseconds{get;private set;}=50;
  public int Observe(double now,double backlog){if(backlog>=.12)pressureUntil=now+2;return IntervalMilliseconds=now<pressureUntil?100:50;}
 }
}
