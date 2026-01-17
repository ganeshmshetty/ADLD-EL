`timescale 1ns/1ps

module tb_secure_voting_machine;

    reg clk;
    reg reset;
    reg [3:0] admin_password;
    reg enable_admin;
    reg result_mode;
    reg vote_a, vote_b, vote_c;

    wire [7:0] count_a, count_b, count_c;
    wire [1:0] winner;
    wire voting_enabled;
    wire busy;

    secure_voting_machine DUT (
        .clk(clk),
        .reset(reset),
        .admin_password(admin_password),
        .enable_admin(enable_admin),
        .result_mode(result_mode),
        .vote_a(vote_a),
        .vote_b(vote_b),
        .vote_c(vote_c),
        .count_a(count_a),
        .count_b(count_b),
        .count_c(count_c),
        .winner(winner),
        .voting_enabled(voting_enabled),
        .busy(busy)
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
        vote_a = 0;
        vote_b = 0;
        vote_c = 0;

        #10 reset = 0;

        // Admin authentication
        #10 admin_password = 4'b1010;
        enable_admin = 1;
        #10 enable_admin = 0;

        // Vote for candidate A
        #20 vote_a = 1;
        #10 vote_a = 0;

        // Vote for candidate B
        #30 vote_b = 1;
        #10 vote_b = 0;

        // Vote for candidate C
        #30 vote_c = 1;
        #10 vote_c = 0;

        // Enable result mode
        #50 result_mode = 1;

        #50 $finish;
    end

endmodule