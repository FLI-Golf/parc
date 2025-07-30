FROM alpine:latest

# Install dependencies
RUN apk add --no-cache ca-certificates

# Create directory for pocketbase
WORKDIR /app

# Copy pocketbase binary
COPY pocketbase /app/pocketbase

# Expose port
EXPOSE 8080

# Run pocketbase
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8080"]
