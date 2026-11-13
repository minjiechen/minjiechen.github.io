Version 4
SymbolType BLOCK
RECTANGLE Normal -96 -72 96 40
TEXT 0 -56 Center 2 PM-SPICE
ARC Normal -16 -16 16 16 12 12 -12 12
ARC Normal 8 -16 40 16 40 0 12 12
ARC Normal -40 -16 -8 16 -12 12 -40 0
LINE Normal -40 -26 40 -26
LINE Normal -40 -30 40 -30
LINE Normal -128 0 -40 0
LINE Normal 40 0 128 0
CIRCLE Normal -51 -11 -45 -5
WINDOW 0 0 -80 Bottom 2
WINDOW 3 0 48 Top 2
WINDOW 39 0 72 Top 1
WINDOW 40 0 92 Top 1
SYMATTR Prefix X
SYMATTR Value DAB_L_LLG
SYMATTR ModelFile DAB_L_LLG.lib
SYMATTR SpiceLine Ms=388000 alpha=5.13333 gamma=1.76e11
SYMATTR SpiceLine2 Hani_z=2.79483 Hani_y=127.943 mx0=0 my0=1 mz0=0
SYMATTR Description PM-SPICE MLM + LLG cores (dot = PortP). Needs .tran ... uic
PIN -128 0 NONE 0
PINATTR PinName PortP1
PINATTR SpiceOrder 1
PIN 128 0 NONE 0
PINATTR PinName PortN1
PINATTR SpiceOrder 2
