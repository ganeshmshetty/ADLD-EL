module secure_voting_machine (
    input clk,
    input reset,

    // Admin controls
    input [3:0] admin_password,
    input enable_admin,
    input result_mode,

    // Vote inputs
    input vote_a,
    input vote_b,
    input vote_c,

    // Outputs
    output reg [7:0] count_a,
    output reg [7:0] count_b,
    output reg [7:0] count_c,
    output reg [1:0] winner,
    output reg voting_enabled,
    output reg busy
);

    // Password
    parameter PASSWORD = 4'b1010;

    // FSM States
    parameter RESET_S = 3'b000,
              AUTH    = 3'b001,
              IDLE    = 3'b010,
              VOTE    = 3'b011,
              LOCK    = 3'b100,
              RESULT  = 3'b101;

    reg [2:0] state, next_state;
    reg auth_ok;

    // FSM state register
    always @(posedge clk or posedge reset) begin
        if (reset)
            state <= RESET_S;
        else
            state <= next_state;
    end

    // FSM next-state logic
    always @(*) begin
        case (state)
            RESET_S:
                next_state = AUTH;

            AUTH:
                if (enable_admin && admin_password == PASSWORD)
                    next_state = IDLE;
                else
                    next_state = AUTH;

            IDLE:
                if (result_mode)
                    next_state = RESULT;
                else if (voting_enabled && (vote_a || vote_b || vote_c))
                    next_state = VOTE;
                else
                    next_state = IDLE;

            VOTE:
                next_state = LOCK;

            LOCK:
                if (!vote_a && !vote_b && !vote_c)
                    next_state = IDLE;
                else
                    next_state = LOCK;

            RESULT:
                next_state = RESULT;

            default:
                next_state = RESET_S;
        endcase
    end

    // Output and control logic
    always @(posedge clk or posedge reset) begin
        if (reset) begin
            count_a <= 0;
            count_b <= 0;
            count_c <= 0;
            voting_enabled <= 0;
            busy <= 0;
        end else begin
            case (state)
                AUTH: begin
                    if (admin_password == PASSWORD)
                        voting_enabled <= 1;
                end

                IDLE: begin
                    busy <= 0;
                end

                VOTE: begin
                    busy <= 1;
                    if (vote_a)
                        count_a <= count_a + 1;
                    else if (vote_b)
                        count_b <= count_b + 1;
                    else if (vote_c)
                        count_c <= count_c + 1;
                end

                LOCK: begin
                    busy <= 0;
                end

                RESULT: begin
                    voting_enabled <= 0;
                end
            endcase
        end
    end

    // Winner detection
    always @(*) begin
        if (state == RESULT) begin
            if (count_a > count_b && count_a > count_c)
                winner = 2'b00;
            else if (count_b > count_a && count_b > count_c)
                winner = 2'b01;
            else if (count_c > count_a && count_c > count_b)
                winner = 2'b10;
            else
                winner = 2'b11; // Tie
        end else begin
            winner = 2'b11;
        end
    end

endmodule