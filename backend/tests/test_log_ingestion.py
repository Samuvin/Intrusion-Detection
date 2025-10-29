"""
Tests for Log Ingestion Engine.
"""

import pytest
import asyncio
import json
import tempfile
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.data.log_ingestion import (
    LogProcessor, LogParser, LogFormat, LogEntry, LogAggregator
)


class TestLogEntry:
    """Test cases for LogEntry class."""
    
    def test_log_entry_creation(self):
        """Test creating a log entry."""
        timestamp = datetime.now(timezone.utc)
        entry = LogEntry(
            timestamp=timestamp,
            source_ip="192.168.1.1",
            destination_ip="10.0.0.1",
            source_port=80,
            destination_port=443,
            protocol="tcp",
            bytes_sent=1024,
            bytes_received=512,
            message="Test log entry"
        )
        
        assert entry.timestamp == timestamp
        assert entry.source_ip == "192.168.1.1"
        assert entry.destination_ip == "10.0.0.1"
        assert entry.source_port == 80
        assert entry.destination_port == 443
        assert entry.protocol == "tcp"
        assert entry.bytes_sent == 1024
        assert entry.bytes_received == 512
        assert entry.message == "Test log entry"
    
    def test_to_dict(self):
        """Test converting log entry to dictionary."""
        timestamp = datetime.now(timezone.utc)
        entry = LogEntry(
            timestamp=timestamp,
            source_ip="192.168.1.1",
            message="Test message"
        )
        
        entry_dict = entry.to_dict()
        assert isinstance(entry_dict, dict)
        assert entry_dict['timestamp'] == timestamp.isoformat()
        assert entry_dict['source_ip'] == "192.168.1.1"
        assert entry_dict['message'] == "Test message"
    
    def test_extract_network_features(self):
        """Test extracting network features from log entry."""
        entry = LogEntry(
            timestamp=datetime.now(timezone.utc),
            source_ip="192.168.1.1",
            destination_ip="10.0.0.1",
            source_port=80,
            destination_port=443,
            protocol="tcp",
            bytes_sent=1024,
            bytes_received=512,
            status_code=200,
            duration=1.5
        )
        
        features = entry.extract_network_features()
        
        assert isinstance(features, dict)
        assert features['bytes_total'] == 1536  # 1024 + 512
        assert features['duration'] == 1.5
        assert features['source_port'] == 80.0
        assert features['destination_port'] == 443.0
        assert features['protocol_encoded'] == 1  # tcp = 1
        assert features['status_code'] == 200.0
        assert features['is_error'] == 0.0  # 200 is not an error


class TestLogParser:
    """Test cases for LogParser class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.parser = LogParser()
    
    @pytest.mark.asyncio
    async def test_parse_json_log(self):
        """Test parsing JSON format log."""
        json_log = json.dumps({
            "timestamp": "2023-12-01T12:00:00Z",
            "source_ip": "192.168.1.1",
            "destination_ip": "10.0.0.1",
            "method": "GET",
            "uri": "/api/test",
            "status_code": 200,
            "message": "API request"
        })
        
        entry = await self.parser.parse_log_line(json_log, LogFormat.JSON, "test_source")
        
        assert entry is not None
        assert entry.source_ip == "192.168.1.1"
        assert entry.destination_ip == "10.0.0.1"
        assert entry.method == "GET"
        assert entry.uri == "/api/test"
        assert entry.status_code == 200
        assert entry.message == "API request"
        assert entry.log_source == "test_source"
    
    @pytest.mark.asyncio
    async def test_parse_csv_log(self):
        """Test parsing CSV format log."""
        csv_log = '"2023-12-01T12:00:00Z","Test message","192.168.1.1"'
        
        entry = await self.parser.parse_log_line(csv_log, LogFormat.CSV, "csv_source")
        
        assert entry is not None
        assert entry.message == "Test message"
        assert entry.log_source == "csv_source"
    
    @pytest.mark.asyncio
    async def test_parse_apache_log(self):
        """Test parsing Apache format log."""
        apache_log = '192.168.1.1 - - [01/Dec/2023:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 1024'
        
        entry = await self.parser.parse_log_line(apache_log, LogFormat.APACHE, "apache_source")
        
        assert entry is not None
        assert entry.source_ip == "192.168.1.1"
        assert entry.method == "GET"
        assert entry.uri == "/index.html"
        assert entry.status_code == 200
        assert entry.bytes_sent == 1024
    
    @pytest.mark.asyncio
    async def test_parse_network_traffic_log(self):
        """Test parsing network traffic log."""
        network_log = "2023-12-01 12:00:00 192.168.1.1:80 10.0.0.1:443 tcp 1024 1.5"
        
        entry = await self.parser.parse_log_line(network_log, LogFormat.NETWORK_TRAFFIC, "network_source")
        
        assert entry is not None
        assert entry.source_ip == "192.168.1.1"
        assert entry.destination_ip == "10.0.0.1"
        assert entry.source_port == 80
        assert entry.destination_port == 443
        assert entry.protocol == "tcp"
        assert entry.bytes_sent == 1024
        assert entry.duration == 1.5
    
    @pytest.mark.asyncio
    async def test_parse_invalid_log(self):
        """Test parsing invalid log line."""
        # Should not crash, should return entry with message set to original line
        entry = await self.parser.parse_log_line("invalid log format", LogFormat.JSON)
        
        assert entry is not None
        assert entry.message == "invalid log format"
    
    @pytest.mark.asyncio
    async def test_parse_empty_log(self):
        """Test parsing empty log line."""
        entry = await self.parser.parse_log_line("", LogFormat.JSON)
        assert entry is None
    
    def test_timestamp_parsing(self):
        """Test timestamp parsing with various formats."""
        test_cases = [
            "2023-12-01 12:00:00",
            "2023-12-01T12:00:00Z",
            "2023-12-01T12:00:00.123Z",
            "01/Dec/2023:12:00:00 +0000",
            "Dec 01 12:00:00"
        ]
        
        for timestamp_str in test_cases:
            result = self.parser._parse_timestamp(timestamp_str)
            assert isinstance(result, datetime)
    
    def test_safe_conversions(self):
        """Test safe type conversions."""
        # Test safe_int
        assert self.parser._safe_int("123") == 123
        assert self.parser._safe_int("invalid") is None
        assert self.parser._safe_int("") is None
        assert self.parser._safe_int("-") is None
        
        # Test safe_float
        assert self.parser._safe_float("123.45") == 123.45
        assert self.parser._safe_float("invalid") is None
        assert self.parser._safe_float("") is None


class TestLogProcessor:
    """Test cases for LogProcessor class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.processor = LogProcessor()
    
    @pytest.mark.asyncio
    async def test_process_log_stream(self):
        """Test processing a stream of log lines."""
        log_lines = [
            '{"timestamp": "2023-12-01T12:00:00Z", "source_ip": "192.168.1.1", "message": "Test 1"}',
            '{"timestamp": "2023-12-01T12:01:00Z", "source_ip": "192.168.1.2", "message": "Test 2"}',
            '{"timestamp": "2023-12-01T12:02:00Z", "source_ip": "192.168.1.3", "message": "Test 3"}'
        ]
        
        entries = await self.processor.process_log_stream(log_lines, LogFormat.JSON, "stream_test")
        
        assert len(entries) == 3
        assert all(entry.log_source == "stream_test" for entry in entries)
        assert entries[0].source_ip == "192.168.1.1"
        assert entries[1].source_ip == "192.168.1.2"
        assert entries[2].source_ip == "192.168.1.3"
    
    @pytest.mark.asyncio
    async def test_process_log_file(self):
        """Test processing a log file."""
        # Create temporary log file
        log_content = """{"timestamp": "2023-12-01T12:00:00Z", "source_ip": "192.168.1.1", "message": "File test 1"}
{"timestamp": "2023-12-01T12:01:00Z", "source_ip": "192.168.1.2", "message": "File test 2"}"""
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            f.write(log_content)
            temp_file_path = f.name
        
        try:
            entries = await self.processor.process_log_file(temp_file_path, LogFormat.JSON, "file_test")
            
            assert len(entries) == 2
            assert all(entry.log_source == "file_test" for entry in entries)
            assert entries[0].message == "File test 1"
            assert entries[1].message == "File test 2"
        
        finally:
            os.unlink(temp_file_path)
    
    def test_add_processing_callback(self):
        """Test adding processing callbacks."""
        callback_called = False
        processed_entries = []
        
        def test_callback(entries):
            nonlocal callback_called, processed_entries
            callback_called = True
            processed_entries.extend(entries)
        
        self.processor.add_processing_callback(test_callback)
        assert test_callback in self.processor.processing_callbacks
    
    def test_file_watching_setup(self):
        """Test setting up file watching."""
        # Create temporary files for testing
        with tempfile.NamedTemporaryFile(delete=False) as f1, \
             tempfile.NamedTemporaryFile(delete=False) as f2:
            
            file_paths = [f1.name, f2.name]
            formats = [LogFormat.JSON, LogFormat.CSV]
            source_names = ["source1", "source2"]
        
        try:
            # This should not raise an exception
            self.processor.start_watching(file_paths, formats, source_names)
            
            # Check that files are being watched
            assert len(self.processor.watched_files) == 2
            
            # Stop watching
            self.processor.stop_watching()
            
        finally:
            for path in file_paths:
                try:
                    os.unlink(path)
                except OSError:
                    pass


class TestLogAggregator:
    """Test cases for LogAggregator class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.aggregator = LogAggregator(window_size=300)  # 5 minute window
    
    @pytest.mark.asyncio
    async def test_add_log_entries(self):
        """Test adding log entries to aggregator."""
        entries = [
            LogEntry(
                timestamp=datetime.now(timezone.utc),
                source_ip="192.168.1.1",
                bytes_sent=1024,
                bytes_received=512
            ),
            LogEntry(
                timestamp=datetime.now(timezone.utc),
                source_ip="192.168.1.2",
                bytes_sent=2048,
                bytes_received=1024
            )
        ]
        
        await self.aggregator.add_log_entries(entries)
        assert len(self.aggregator.log_buffer) == 2
    
    @pytest.mark.asyncio
    async def test_get_aggregated_features(self):
        """Test getting aggregated network features."""
        entries = []
        for i in range(10):
            entry = LogEntry(
                timestamp=datetime.now(timezone.utc),
                source_ip=f"192.168.1.{i+1}",
                destination_ip="10.0.0.1",
                source_port=80,
                destination_port=443,
                protocol="tcp",
                bytes_sent=1024,
                bytes_received=512,
                status_code=200
            )
            entries.append(entry)
        
        await self.aggregator.add_log_entries(entries)
        features = await self.aggregator.get_aggregated_features()
        
        assert isinstance(features, dict)
        if features:  # May be empty if aggregation logic requires more data
            for feature_type, data in features.items():
                assert isinstance(data, list) or hasattr(data, 'shape')
    
    def test_get_statistics(self):
        """Test getting aggregation statistics."""
        # Add some entries first
        entries = [
            LogEntry(
                timestamp=datetime.now(timezone.utc),
                source_ip="192.168.1.1",
                status_code=200
            ),
            LogEntry(
                timestamp=datetime.now(timezone.utc),
                source_ip="192.168.1.1",
                status_code=404
            ),
            LogEntry(
                timestamp=datetime.now(timezone.utc),
                source_ip="192.168.1.2",
                status_code=200
            )
        ]
        
        # Use synchronous method to add entries for testing
        self.aggregator.log_buffer.extend(entries)
        
        stats = self.aggregator.get_statistics()
        
        assert isinstance(stats, dict)
        assert 'total_entries' in stats
        assert 'unique_sources' in stats
        assert 'error_rate' in stats
        assert stats['total_entries'] == 3
        assert stats['unique_sources'] == 2


class TestIntegration:
    """Integration tests for log ingestion components."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_log_processing(self):
        """Test complete log processing workflow."""
        # Setup
        processor = LogProcessor()
        aggregator = LogAggregator()
        processed_entries = []
        
        # Add callback to capture processed entries
        async def capture_callback(entries):
            processed_entries.extend(entries)
            await aggregator.add_log_entries(entries)
        
        processor.add_processing_callback(capture_callback)
        
        # Test data
        log_lines = [
            '{"timestamp": "2023-12-01T12:00:00Z", "source_ip": "192.168.1.1", "destination_ip": "10.0.0.1", "protocol": "tcp", "bytes_sent": 1024}',
            '{"timestamp": "2023-12-01T12:01:00Z", "source_ip": "192.168.1.2", "destination_ip": "10.0.0.1", "protocol": "udp", "bytes_sent": 512}',
            '{"timestamp": "2023-12-01T12:02:00Z", "source_ip": "192.168.1.1", "destination_ip": "10.0.0.2", "protocol": "tcp", "bytes_sent": 2048}'
        ]
        
        # Process logs
        entries = await processor.process_log_stream(log_lines, LogFormat.JSON, "integration_test")
        
        # Verify processing
        assert len(entries) == 3
        assert len(processed_entries) == 3
        assert len(aggregator.log_buffer) == 3
        
        # Verify aggregated features
        features = await aggregator.get_aggregated_features()
        # Features may be empty with limited test data, but should not error
        assert isinstance(features, dict)
        
        # Verify statistics
        stats = aggregator.get_statistics()
        assert stats['total_entries'] == 3
        assert stats['unique_sources'] == 2
    
    @pytest.mark.asyncio
    async def test_large_scale_processing(self):
        """Test processing large number of log entries."""
        processor = LogProcessor()
        aggregator = LogAggregator()
        
        # Generate large number of log entries
        import time
        start_time = time.time()
        
        log_lines = []
        for i in range(1000):
            log_line = json.dumps({
                "timestamp": f"2023-12-01T12:{i%60:02d}:{i%60:02d}Z",
                "source_ip": f"192.168.{i%255}.{(i*7)%255}",
                "destination_ip": "10.0.0.1",
                "protocol": "tcp" if i % 2 == 0 else "udp",
                "bytes_sent": (i * 13) % 10000,
                "status_code": 200 if i % 10 < 8 else 404
            })
            log_lines.append(log_line)
        
        # Process all entries
        entries = await processor.process_log_stream(log_lines, LogFormat.JSON, "scale_test")
        await aggregator.add_log_entries(entries)
        
        processing_time = time.time() - start_time
        
        # Verify results
        assert len(entries) == 1000
        assert processing_time < 10  # Should process 1000 entries in less than 10 seconds
        
        # Get statistics
        stats = aggregator.get_statistics()
        assert stats['total_entries'] == 1000
        assert stats['unique_sources'] > 1  # Should have multiple unique source IPs
        
        # Error rate should be around 20% (2 out of 10 have status 404)
        expected_error_rate = 0.2
        assert abs(stats['error_rate'] - expected_error_rate) < 0.1


if __name__ == '__main__':
    pytest.main([__file__])
