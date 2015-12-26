package ee.leola.kassa.obligation.model;

import ee.leola.kassa.models.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.persistence.Entity;
import javax.persistence.ManyToOne;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Data
@EqualsAndHashCode(callSuper = true)
public class Obligation extends Model {
	@ManyToOne
	private ObligationType obligationType;
	private String description;
	private Date time;
	private BigDecimal amount;
	private Date dateCreated;
}