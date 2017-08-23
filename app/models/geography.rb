class Geography < ActiveRecord::Base
  has_many :series

  def Geography.get_or_new_nta(attrs, add_attrs = {})
    attrs.merge!(universe: 'NTA')
    geo = Geography.find_by(attrs)
    unless geo
      parents = add_attrs[:parents] ? [add_attrs.delete(:parents)].flatten : []
      geo = Geography.create(attrs.merge(add_attrs))
      unless parents.empty?
        parents.each {|pid| GeoTree.create(parent_id: pid, child_id: geo.id) }
      end
    end
    geo
  end
end
