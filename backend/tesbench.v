`timescale 1ns/1ps

module tb_secure_voting_machine;

    reg clk;
    reg reset;
    reg [3:0] admin_password;
    reg [3:0] voter_id;
    reg enable_admin;
    reg result_mode;
    reg vote_a, vote_b, vote_c;

    wire [7:0] count_a, count_b, count_c;
    wire [1:0] winner;
    wire voting_enabled;
    wire busy;
    wire tie_flag;
    wire [31:0] ledger_hash;
    wire [7:0]  block_count;

    secure_voting_machine DUT (
        .clk(clk),
        .reset(reset),
        .admin_password(admin_password),
        .enable_admin(enable_admin),
        .result_mode(result_mode),
        .voter_id(voter_id),
        .vote_a(vote_a),
        .vote_b(vote_b),
        .vote_c(vote_c),
        .count_a(count_a),
        .count_b(count_b),
        .count_c(count_c),
        .winner(winner),
        .voting_enabled(voting_enabled),
        .busy(busy),
        .tie_flag(tie_flag),
        .ledger_hash(ledger_hash),
        .block_count(block_count)
    );

    // Clock generation
    always #5 clk = ~clk;

    initial begin
        $dumpfile("voting.vcd");
        $dumpvars(0, tb_secure_voting_machine);

        clk = 0;
        reset = 1;
        admin_password = 0;
        enable_admin = 0;
        result_mode = 0;
        voter_id = 0;
        vote_a = 0;
        vote_b = 0;
        vote_c = 0;

        #10 reset = 0;

        $display("=== BLOCKCHAIN VOTING MACHINE TESTBENCH ===");
        $display("Genesis Hash: %h", ledger_hash);
        $display("Block Count:  %0d", block_count);

        // Admin authentication
        #10 admin_password = 4'b1010;
        enable_admin = 1;
        #10 enable_admin = 0;
        $display("\n--- Admin Authenticated ---");
        $display("Voting Enabled: %b", voting_enabled);

        // Vote for candidate A (Voter 1)
        #20 voter_id = 4'd1;
        vote_a = 1;
        #10 vote_a = 0;
        #10;
        $display("\n--- Block #%0d: Voter 1 -> Candidate A ---", block_count);
        $display("  Ledger Hash: %h", ledger_hash);
        $display("  Count A=%0d  B=%0d  C=%0d", count_a, count_b, count_c);

        // Try to vote again with Voter 1 (Should be ignored)
        #20 vote_b = 1;
        #10 vote_b = 0;
        #10;
        $display("\n--- Replay Attack: Voter 1 tries again ---");
        $display("  Ledger Hash: %h (should be unchanged)", ledger_hash);
        $display("  Block Count: %0d (should be unchanged)", block_count);

        // Vote for candidate B (Voter 2)
        #20 voter_id = 4'd2;
        vote_b = 1;
        #10 vote_b = 0;
        #10;
        $display("\n--- Block #%0d: Voter 2 -> Candidate B ---", block_count);
        $display("  Ledger Hash: %h", ledger_hash);
        $display("  Count A=%0d  B=%0d  C=%0d", count_a, count_b, count_c);

        // Vote for candidate C (Voter 3)
        #20 voter_id = 4'd3;
        vote_c = 1;
        #10 vote_c = 0;
        #10;
        $display("\n--- Block #%0d: Voter 3 -> Candidate C ---", block_count);
        $display("  Ledger Hash: %h", ledger_hash);
        $display("  Count A=%0d  B=%0d  C=%0d", count_a, count_b, count_c);

        // Vote for candidate A (Voter 4)
        #20 voter_id = 4'd4;
        vote_a = 1;
        #10 vote_a = 0;
        #10;
        $display("\n--- Block #%0d: Voter 4 -> Candidate A ---", block_count);
        $display("  Ledger Hash: %h", ledger_hash);
        $display("  Count A=%0d  B=%0d  C=%0d", count_a, count_b, count_c);

        // Enable result mode
        #50 result_mode = 1;
        #20;
        $display("\n=== FINAL RESULTS ===");
        $display("  Count A=%0d  B=%0d  C=%0d", count_a, count_b, count_c);
        $display("  Winner: %b  Tie: %b", winner, tie_flag);
        $display("  Final Ledger Hash: %h", ledger_hash);
        $display("  Total Blocks: %0d", block_count);
        $display("========================");

        #20 $finish;
    end

endmodule