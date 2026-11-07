using System.Collections.Generic;
using Poker;
namespace IslandGame {
 public static class ShowdownSelection {
  // Presentation only. Server remains the sole authority for winners, pots and rake.
  public static HashSet<int> BestFive(string[] hole,string[] board){
   var result=new HashSet<int>();if(hole==null||hole.Length!=2||board==null||board.Length!=5)return result;
   var raw=new List<string>(hole);raw.AddRange(board);if(new HashSet<string>(raw).Count!=7||raw.Contains("??"))return result;
   var all=PokerHandEvaluator.ParseCards(raw.ToArray());int best=-1,bestHole=-1;
   for(int i=0;i<7;i++)for(int j=i+1;j<7;j++){
    var cards=new List<PokerHandEvaluator.Card>();var chosen=new HashSet<int>();int usedHole=0;
    for(int k=0;k<7;k++)if(k!=i&&k!=j){cards.Add(all[k]);chosen.Add(k);if(k<2)usedHole++;}
    int score=PokerHandEvaluator.EvaluateBestHand(cards.GetRange(0,2).ToArray(),cards.GetRange(2,3).ToArray());
    if(score>best||score==best&&usedHole>bestHole){best=score;bestHole=usedHole;result=chosen;}
   }return result;
  }
 }
}
