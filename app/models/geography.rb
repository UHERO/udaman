class Geography < ActiveRecord::Base
  has_many :series

  def Geography.get_or_new_dbedt(attrs, add_attrs = {})
    attrs.merge!(universe: 'DBEDT')
    Geography.find_by(attrs) || Geography.create(attrs.merge(add_attrs))
  end

  def get_or_new_nta(attrs, add_attrs = {})
    handle = attrs[:handle]
    return @cache[handle] if @cache[handle]

    attrs.merge!(universe: 'NTA')
    geo = Geography.find_by(attrs)
    unless geo
      parents = add_attrs[:parents] ? [add_attrs.delete(:parents)].flatten : []
      geo = Geography.create(attrs.merge(add_attrs))
      unless parents.empty?
        parents.each {|pid| GeoTree.create(parent_id: pid, child_id: geo.id) }
      end
    end
    @cache[handle] ||= geo
  end

  def Geography.get_or_new_nta(attrs, add_attrs = {})
    Geography.new.get_or_new_nta(attrs, add_attrs)
  end
end
