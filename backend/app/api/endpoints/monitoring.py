"""
Real-time monitoring API endpoints.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import json
import asyncio
import logging
from datetime import datetime
import random

from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time monitoring."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific connection."""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Failed to send message: {str(e)}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: str):
        """Broadcast a message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to broadcast message: {str(e)}")
                disconnected.append(connection)
        
        # Remove failed connections
        for connection in disconnected:
            self.disconnect(connection)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/live")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time monitoring.
    """
    await manager.connect(websocket)
    
    try:
        # Start real-time monitoring
        monitoring_task = asyncio.create_task(
            simulate_network_monitoring(websocket)
        )
        
        # Listen for client messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get('type') == 'ping':
                    await websocket.send_text(json.dumps({
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat()
                    }))
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                break
    
    except WebSocketDisconnect:
        pass
    finally:
        monitoring_task.cancel()
        manager.disconnect(websocket)


async def simulate_network_monitoring(websocket: WebSocket):
    """
    Simulate real-time network traffic monitoring.
    """
    attack_types = ['Normal', 'DoS', 'Probe', 'U2R', 'R2L']
    
    while True:
        try:
            # Simulate network traffic data
            traffic_data = {
                'timestamp': datetime.now().isoformat(),
                'type': 'traffic_update',
                'data': {
                    'total_connections': random.randint(50, 200),
                    'suspicious_activities': random.randint(0, 10),
                    'blocked_attacks': random.randint(0, 5),
                    'current_threat_level': random.choice(['Low', 'Medium', 'High']),
                    'attack_breakdown': {
                        attack_type: random.randint(0, 20) 
                        for attack_type in attack_types
                    },
                    'network_metrics': {
                        'bandwidth_usage': random.uniform(30, 90),
                        'packet_loss': random.uniform(0, 5),
                        'latency': random.uniform(10, 50)
                    }
                }
            }
            
            # Simulate occasional attack detection
            if random.random() < 0.3:  # 30% chance of attack
                attack_data = {
                    'timestamp': datetime.now().isoformat(),
                    'type': 'attack_detected',
                    'data': {
                        'attack_type': random.choice(attack_types[1:]),  # Exclude 'Normal'
                        'source_ip': f"192.168.{random.randint(1, 255)}.{random.randint(1, 255)}",
                        'target_port': random.choice([22, 80, 443, 3389, 21]),
                        'severity': random.choice(['Low', 'Medium', 'High', 'Critical']),
                        'confidence': random.uniform(0.7, 0.99),
                        'details': f"Suspicious activity detected from external source"
                    }
                }
                
                await websocket.send_text(json.dumps(attack_data))
            
            # Send regular traffic update
            await websocket.send_text(json.dumps(traffic_data))
            
            # Wait before next update
            await asyncio.sleep(2)
            
        except Exception as e:
            logger.error(f"Monitoring simulation error: {str(e)}")
            break


@router.get("/status")
async def get_monitoring_status() -> Dict[str, Any]:
    """
    Get current monitoring status.
    
    Returns:
        Current monitoring status and statistics
    """
    try:
        # Simulate current system status
        status = {
            'monitoring_active': len(manager.active_connections) > 0,
            'connected_clients': len(manager.active_connections),
            'system_health': 'Healthy',
            'uptime': '2 days, 14 hours, 32 minutes',
            'last_update': datetime.now().isoformat(),
            'statistics': {
                'total_connections_today': random.randint(1000, 5000),
                'attacks_blocked_today': random.randint(10, 100),
                'false_positives': random.randint(1, 10),
                'system_accuracy': random.uniform(0.95, 0.99)
            }
        }
        
        return {
            'status': 'success',
            'monitoring_status': status
        }
        
    except Exception as e:
        logger.error(f"Failed to get monitoring status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulate-attack")
async def simulate_attack(attack_type: str = "DoS") -> Dict[str, Any]:
    """
    Simulate an attack for testing purposes.
    
    Args:
        attack_type: Type of attack to simulate
        
    Returns:
        Simulation results
    """
    try:
        valid_attacks = ['DoS', 'Probe', 'U2R', 'R2L']
        if attack_type not in valid_attacks:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid attack type. Must be one of: {valid_attacks}"
            )
        
        # Create simulated attack data
        attack_simulation = {
            'timestamp': datetime.now().isoformat(),
            'type': 'simulated_attack',
            'data': {
                'attack_type': attack_type,
                'source_ip': f"10.0.{random.randint(1, 255)}.{random.randint(1, 255)}",
                'target_ip': f"192.168.1.{random.randint(1, 255)}",
                'port': random.choice([22, 80, 443, 3389, 21]),
                'packets': random.randint(100, 1000),
                'duration': random.randint(5, 60),
                'severity': 'High',
                'confidence': 0.95,
                'status': 'Detected and Blocked'
            }
        }
        
        # Broadcast to all connected clients
        await manager.broadcast(json.dumps(attack_simulation))
        
        logger.info(f"Simulated {attack_type} attack broadcasted to {len(manager.active_connections)} clients")
        
        return {
            'status': 'success',
            'message': f"{attack_type} attack simulation completed",
            'simulation_data': attack_simulation['data']
        }
        
    except Exception as e:
        logger.error(f"Attack simulation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
