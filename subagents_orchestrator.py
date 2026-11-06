"""
Orquestador de Subagentes con Antigravity SDK para Inversion Bot
================================================================
Permite gestionar y orquestar subagentes especializados usando el SDK oficial `google-antigravity`.
"""

from typing import List, Optional
from google.antigravity import (
    Agent,
    LocalAgentConfig,
    CapabilitiesConfig
)
from google.antigravity.types import SubagentConfig


def build_inversion_bot_subagents() -> List[SubagentConfig]:
    """Crea la definición de subagentes especializados para el flujo de inversión y desarrollo."""
    return [
        SubagentConfig(
            name="dev-code",
            description="Experto en implementación y código. Desarrolla features, refactoriza y escribe lógica de negocio.",
            system_instructions=(
                "Eres dev-code, subagente de desarrollo de software para inversion_bot. "
                "Tu única responsabilidad es escribir, modificar y refactorizar código en Python/TypeScript. "
                "Sigue las convenciones del repositorio, modulariza las funciones y entrega código probado y funcional."
            ),
        ),
        SubagentConfig(
            name="dev-test",
            description="Especialista en pruebas unitarias, de integración y validación cuantitativa.",
            system_instructions=(
                "Eres dev-test, subagente de pruebas y aseguramiento de calidad. "
                "Generas y ejecutas suites con pytest, validas cálculos financieros, evitas data leakage "
                "en modelos de machine learning y aseguras cobertura sin alterar la lógica de negocio."
            ),
        ),
        SubagentConfig(
            name="dev-review",
            description="Revisor de código senior para calidad, seguridad y rendimiento.",
            system_instructions=(
                "Eres dev-review, revisor senior. Inspeccionas código en busca de bugs, seguridad de credenciales (.env), "
                "eficiencia numérica (vectorización con pandas/numpy) y cumplimiento de estándares antes de mergear."
            ),
        ),
        SubagentConfig(
            name="quant-risk",
            description="Especialista cuantitativo en control de riesgo, drawdown, sizing y métricas Sharpe/Sortino.",
            system_instructions=(
                "Eres quant-risk, subagente cuantitativo de riesgo. Supervisas el cálculo de Value-at-Risk (VaR), "
                "límites de drawdown, dimensionamiento de posiciones (position sizing) y reglas de Smart DCA."
            ),
        ),
        SubagentConfig(
            name="mlops",
            description="Especialista en pipelines de machine learning, serialización de modelos y Supabase/Vercel.",
            system_instructions=(
                "Eres mlops, especialista en ciclo de vida de ML. Gestionas el entrenamiento, versionado con joblib, "
                "integración con Supabase DB/Storage y despliegues serverless en Vercel."
            ),
        ),
    ]


def get_agent_config(system_instructions: Optional[str] = None) -> LocalAgentConfig:
    """Retorna la configuración completa del agente principal con subagentes y capacidades."""
    subagents = build_inversion_bot_subagents()
    instructions = system_instructions or (
        "Eres el Agente Principal de Inversion Bot. Tu objetivo es orquestar los flujos de trabajo "
        "financieros, de ML y desarrollo delegando tareas especializadas en tus subagentes concurrentes."
    )
    return LocalAgentConfig(
        system_instructions=instructions,
        subagents=subagents,
        capabilities=CapabilitiesConfig()
    )


if __name__ == "__main__":
    config = get_agent_config()
    print(f"✓ Configuración de Antigravity SDK exitosa.")
    print(f"✓ Subagentes registrados ({len(config.subagents)}):")
    for sa in config.subagents:
        print(f"  - [{sa.name}]: {sa.description}")
